from __future__ import annotations
import os
import re
import logging
import unicodedata

from ..schemas import ChatRequest, ChatResponse
from ..core.config import settings

logger = logging.getLogger(__name__)


def _is_arabic_text(text: str) -> bool:
    """Return True when the bulk of the text is Arabic script (not Latin/English).

    Checks the ratio of Arabic characters to total non-whitespace characters.
    If the text is primarily Arabic, returns True; if primarily English/Latin,
    returns False.  Mixed text with >20% Arabic characters is treated as Arabic.
    """
    if not text:
        return False
    arabic_count = 0
    total = 0
    for ch in text:
        if ch.isspace():
            continue
        total += 1
        cat = unicodedata.category(ch)
        # Arabic characters are in the "Lo" (Letter, other) category
        # with codepoints in the range U+0600-U+06FF (Arabic) and
        # U+0750-U+077F (Arabic Supplement), U+FB50-U+FDFF, U+FE70-U+FEFF
        cp = ord(ch)
        if (0x0600 <= cp <= 0x06FF or 0x0750 <= cp <= 0x077F
                or 0xFB50 <= cp <= 0xFDFF or 0xFE70 <= cp <= 0xFEFF):
            arabic_count += 1
    if total == 0:
        return False
    return (arabic_count / total) >= 0.20

try:
    from langchain_groq import ChatGroq
except ImportError:
    ChatGroq = None


def _llm_generate(prompt: str, system: str = "", grounding_mode: str = "general") -> str | None:
    """Try Groq first, then Gemini. Returns None when no provider is usable.

    grounding_mode="strict" forbids the model from answering anything outside
    the provided lesson material (used when a specific lesson is open).
    """
    groq_key = settings.GROQ_API_KEY or os.getenv("GROQ_API_KEY", "")
    if groq_key and ChatGroq is not None:
        try:
            model_name = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
            model = ChatGroq(model=model_name, temperature=0.4, max_tokens=1024, api_key=groq_key)
            messages = []
            if system:
                messages.append(("system", system))
            messages.append(("human", prompt))
            return model.invoke(messages).content.strip()
        except Exception as exc:
            logger.warning("Groq tutor call failed: %s", exc)
    try:
        from . import gemini
        if gemini.ai_available():
            out = gemini._generate((f"{system}\n\n" if system else "") + prompt)
            if out:
                return out.strip()
    except Exception as exc:
        logger.debug("Gemini tutor fallback failed: %s", exc)
    return None


def _llm_generate_ar(prompt: str, system: str = "") -> str | None:
    """Generate Arabic content with a short, focused system prompt.

    Used as a retry when the first LLM call returned English despite an Arabic
    language request.  The system prompt is intentionally short and explicit to
    maximise compliance from small models like llama-3.1-8b-instant.
    """
    groq_key = settings.GROQ_API_KEY or os.getenv("GROQ_API_KEY", "")
    if groq_key and ChatGroq is not None:
        try:
            model_name = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
            model = ChatGroq(model=model_name, temperature=0.4, max_tokens=1024, api_key=groq_key)
            # Short, focused Arabic-only prompt
            ar_system = (
                "أنت مدرس خبير على منصة شغف. أجب بالعامية المصرية فقط. "
                "لا تستخدم الإنجليزية إلا للمصطلحات التقنية. "
                "اجعل الإجابة مختصرة وواضحة."
            )
            messages = [("system", ar_system)]
            if system:
                messages.append(("system", system))
            messages.append(("human", prompt))
            return model.invoke(messages).content.strip()
        except Exception as exc:
            logger.warning("Groq Arabic retry failed: %s", exc)
    return None


_SYSTEM_PROMPT = """\
You are Shaghoof AI, an expert educational tutor for students. You are warm, encouraging, and highly knowledgeable.

CORE RULES:
- Be concise and clear. Use simple language appropriate for the student's level.
- Adapt your explanation style to the requested modality (visual, auditory, reading/writing, kinesthetic).
- For Feynman level "intuitive": explain like talking to a 12-year-old. Use analogies and everyday examples. The "Grandma Test" — could your grandma understand it?
- For Feynman level "academic": use proper terminology and structured explanations.
- For Feynman level "deep": go into technical depth with formulas and detailed analysis.
- Always be encouraging and supportive. Celebrate small wins.
- If you don't know something specific, say so honestly rather than making things up.
- Keep responses focused (2-4 paragraphs max unless asked for more detail).
- Use markdown formatting: **bold** for key terms, bullet points for lists, and clear subheadings.

VARK MODALITY ADAPTATION:
- Visual: Use descriptions of diagrams, charts, mind maps. Suggest visual study aids.
- Auditory: Structure responses as conversational explanations. Suggest podcasts/verbal repetition.
- Reading/Writing: Use structured text, definitions, written summaries. Suggest note-taking.
- Kinesthetic: Use real-world examples, step-by-step processes, hands-on activities.

FEYNMAN TECHNIQUE:
- When asked to "explain simply" or "eli5", break the concept into the simplest building blocks.
- Use analogies from everyday life (sports, cooking, games, etc.).
- If the student is struggling, offer a hint rather than the full answer.

LANGUAGE & DIALECT RULES:
- When language="ar" and egyptian_dialect=true: Respond in Egyptian Arabic dialect (عامية مصرية).
  Use casual, friendly Egyptian expressions like "بص يا سيدي", "إزيك", "يلا", "تمام", "الله ينور".
  Keep technical terms in English but explain them in Egyptian dialect.
- When language="ar" and egyptian_dialect=false: Respond in Modern Standard Arabic (الفصحى).
  Use formal academic Arabic with proper grammar.
- When language="en": Respond in clear, natural English.
- Always match the student's language preference consistently throughout the conversation.
"""


_STRICT_GROUNDING_PROMPT = """\

STRICT LESSON GROUNDING (HIGHEST PRIORITY — overrides everything above):
- You are INSIDE a specific lesson. Answer ONLY from the LESSON MATERIAL given below.
- If the answer is not in the lesson material, say exactly: "This isn't covered in the current lesson 📖" —
  then point to the closest related part of the lesson, and suggest asking the teacher.
- NEVER use outside knowledge, even if you know the answer. Never invent facts.
- Every claim must be traceable to a phrase in the lesson material. Quote or closely paraphrase it.
- End every supported answer with one exact short quotation from the lesson in this format:
  [Lesson evidence: "exact words from the material"]
- If the question is about the lesson itself ("what is this lesson about?", "summarize this"), answer from the material.
- NEVER generate random examples, analogies, or explanations not found in the lesson material.
- If you cannot find relevant information in the lesson, respond with the refusal message.
"""


def _strict_refusal(req: ChatRequest) -> ChatResponse:
    title = req.lesson_title or "this lesson"
    is_ar = req.language == "ar"
    text = (f"This isn't covered in the current lesson 📖 — I can only answer questions about “{title}”. "
            "Try asking about one of its key ideas, or ask your teacher.") if not is_ar else (
            f"هذا غير موجود في الدرس الحالي 📖 — أستطيع الإجابة فقط عن أسئلة “{title}”. "
            "جرّب السؤال عن إحدى الأفكار الأساسية، أو اسأل معلمك.")
    return ChatResponse(sender="bot", text=text, feynman_level=req.feynman_level or "academic",
                        modality=req.modality or "visual", language=req.language or "en", status="out_of_scope")


def _has_lesson_evidence(reply: str, context_text: str) -> bool:
    """Accept an LLM reply only when its required verbatim evidence is present.
    
    This function enforces that every answer must contain verbatim evidence from the lesson material.
    Returns False if:
    1. No evidence tag is found
    2. The evidence is too short (< 4 characters)
    3. The evidence doesn't appear in the context text
    4. The reply content (before evidence tag) doesn't contain context-relevant words
    """
    if not reply or not context_text:
        return False
    
    # Check for evidence tag
    match = re.search(r'\[Lesson evidence:\s*[\""\u201c]([^\""\u201d]{4,240})[\""\u201d]\]', reply or '', re.I)
    if not match:
        return False
    
    evidence = match.group(1).strip()
    
    # Evidence must be substantial (at least 4 words)
    if len(evidence.split()) < 2:
        return False
    
    # Evidence must appear in the context (case-insensitive)
    evidence_lower = evidence.lower()
    context_lower = context_text.lower()
    
    # Check for exact match or very close match (allowing for minor variations)
    if evidence_lower not in context_lower:
        # Check for significant word overlap (at least 70% of evidence words must be in context)
        evidence_words = set(evidence_lower.split())
        context_words = set(context_lower.split())
        overlap = evidence_words.intersection(context_words)
        if len(evidence_words) == 0 or len(overlap) / len(evidence_words) < 0.7:
            return False
    
    # Additional check: The reply content (before the evidence tag) should contain
    # at least some context-relevant words to ensure the answer is truly grounded
    reply_before_evidence = reply[:match.start()].strip()
    if reply_before_evidence:
        # Extract meaningful words from the reply (skip short words)
        reply_words = set(w.lower() for w in re.findall(r'[a-z\u0600-\u06ff]{4,}', reply_before_evidence))
        context_words = set(w.lower() for w in re.findall(r'[a-z\u0600-\u06ff]{4,}', context_lower))
        
        # At least 20% of reply words should be context-relevant
        if reply_words and context_words:
            overlap = reply_words.intersection(context_words)
            if len(overlap) / len(reply_words) < 0.2:
                return False
    
    return True


def _llm_refused(reply: str) -> bool:
    """True when the LLM itself followed the strict prompt and refused."""
    low = (reply or '').lower()
    return ("isn't covered in the current lesson" in low
            or "not covered in the current lesson" in low
            or "غير موجود في الدرس" in low)


def _reply_matches_lesson(reply: str, context_text: str, min_hits: int = 2) -> bool:
    """Lexical grounding check: does the reply share real lesson vocabulary?

    The evidence-tag contract is the gold standard, but LLMs do not always
    comply. A reply is still accepted when it is clearly woven from the
    lesson's own words (at least 2 distinct lesson terms, or ≥15% overlap).
    Off-topic replies (general knowledge) share almost nothing and are refused.
    """
    reply_words = set(w.lower() for w in re.findall(r'[a-z\u0600-\u06ff]{4,}', reply or ''))
    context_words = set(w.lower() for w in re.findall(r'[a-z\u0600-\u06ff]{4,}', (context_text or '').lower()))
    if not reply_words or not context_words:
        return False
    overlap = reply_words & context_words
    return len(overlap) >= min_hits or len(overlap) / len(reply_words) >= 0.15


def _context_aware_fallback(req: ChatRequest, context_text: str = "", weak_topics: list[str] | None = None) -> ChatResponse:
    """Offline tutor: extracts a genuinely relevant answer from the student's
    own lesson material instead of replying with canned filler.
    
    CRITICAL: This function NEVER generates random content. It only responds
    with information found in the lesson material or provides structured guidance.
    """
    text = req.message.lower()
    username = req.username or "student"
    is_ar = req.language == "ar"

    # 1) Pull the most relevant passages from the student's lessons via
    #    keyword-overlap scoring (stopword-filtered).
    ranked = []
    if context_text:
        stop = {"the", "a", "an", "is", "are", "of", "to", "in", "and", "or", "for", "on", "with",
                "what", "how", "why", "when", "this", "that", "من", "عن", "في", "على", "ما", "ايه"}
        qwords = {w for w in re.findall(r"[a-z\u0600-\u06ff]{3,}", text) if w not in stop}
        if qwords:
            for para in context_text.split("\n"):
                para = para.strip()
                if not para:
                    continue
                words = re.findall(r"[a-z\u0600-\u06ff]{3,}", para.lower())
                score = sum(1 for w in words if w in qwords)
                if score > 0:
                    ranked.append((score, para))
            ranked.sort(key=lambda pair: pair[0], reverse=True)

    hint = "hint" in text or "تلميح" in text
    simplify = "eli5" in text or "simplify" in text or "مبسط" in text

    if ranked:
        body = " ".join(p[:600] for _, p in ranked[:2])
        if hint:
            pre = "Hint 💡 — revisit this part of your lesson: " if not is_ar else "تلميح 💡 — راجع هذا الجزء من درسك: "
        else:
            pre = "From your lesson notes 📖: " if not is_ar else "من دروسك 📖: "
        reply = pre + body
        if weak_topics and not is_ar:
            reply += " (Take your time — this one's a growing edge for you, and that's okay!)"
        return ChatResponse(
            sender="bot", text=reply,
            feynman_level=req.feynman_level or "academic",
            modality=req.modality or "visual", language=req.language or "en", status="success")

    # 2) Strict mode: never drift outside the chosen lesson — even offline.
    if getattr(req, "strict_lesson", False) and context_text:
        return _strict_refusal(req)

    # 3) No lesson context — structured guidance instead of a dead-end reply.
    # CRITICAL: Never generate random content. Only provide structured guidance.
    if hint:
        reply = ("I can help you find hints in your lesson material. "
                 "Try asking about a specific concept from the lesson, or use the quick actions below."
                 if not is_ar else "أساعدك في العثور على تلميحات في مادة درسك. "
                 "حاول السؤال عن مفهوم محدد من الدرس، أو استخدم الأزرار السريعة.")
    elif simplify:
        reply = ("I can help simplify concepts from your lesson material. "
                 "Ask me about a specific topic from the lesson, and I'll explain it simply."
                 if not is_ar else "أساعدك في تبسيط المفاهيم من مادة درسك. "
                 "اسألني عن موضوع محدد من الدرس، وسأشرحه ببساطة.")
    else:
        # Provide structured guidance without generating random content
        reply = (
            f"Hi {username}! I can answer questions about your current lesson material. "
            f"Ask me something specific from the lesson, or try one of the quick actions below. "
            f"Remember: I only answer from the lesson content — I don't generate random information."
            if not is_ar else
            f"أهلاً يا {username}! أستطيع الإجابة عن أسئلة حول مادة درسك الحالية. "
            f"اسألني عن شيء محدد من الدرس، أو جرب أحد الأزرار السريعة. "
            f"تذكر: أجيب فقط من محتوى الدرس — لا أُنشئ معلومات عشوائية."
        )

    return ChatResponse(
        sender="bot", text=reply,
        feynman_level=req.feynman_level or "academic",
        modality=req.modality or "visual", language=req.language or "en", status="success")


class TutorService:
    _cache: dict = {}

    @staticmethod
    def _get_model(api_key: str):
        if api_key in TutorService._cache:
            return TutorService._cache[api_key]
        model_name = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
        model = ChatGroq(model=model_name, temperature=0.4, max_tokens=1024, api_key=api_key)
        TutorService._cache[api_key] = model
        return model

    @staticmethod
    def _system_prompt(req: ChatRequest) -> str:
        if req.language == "ar":
            if req.egyptian_dialect:
                lang_note = (
                    " Respond ONLY in Egyptian Arabic dialect (عامية مصرية). "
                    "Use casual, friendly Egyptian expressions like 'بص يا سيدي', 'إزيك', 'يلا', 'تمام', 'الله ينور'. "
                    "Keep technical terms in English but explain them in Egyptian dialect. "
                    "Example: 'بص يا سيدي، الـ Backpropagation ده زي المدرب بيعدل لعيبة بعد الماتش!'"
                )
            else:
                lang_note = (
                    " Respond ONLY in Modern Standard Arabic (الفصحى). "
                    "Use formal academic Arabic with proper grammar and vocabulary. "
                    "Technical terms can remain in English with Arabic explanations."
                )
        else:
            lang_note = " Respond in clear, natural English."

        modality_map = {
            "visual": "The student prefers VISUAL learning. Use descriptions of diagrams, charts, and mind maps. Suggest visual study aids.",
            "auditory": "The student prefers AUDITORY learning. Structure responses as conversational explanations. Suggest verbal repetition.",
            "reading": "The student prefers READING/WRITING. Use structured text, definitions, and written summaries.",
            "kinesthetic": "The student prefers KINESTHETIC learning. Use real-world examples and step-by-step processes.",
        }
        modality_note = modality_map.get(req.modality or "", "")

        feynman_map = {
            "intuitive": "EXPLAIN SIMPLY — like talking to a 12-year-old. Use everyday analogies. The 'Grandma Test': could your grandma understand it?",
            "academic": "Use proper terminology and structured explanations suitable for a university student.",
            "deep": "Go into technical depth with formulas, mathematical details, and comprehensive analysis.",
        }
        feynman_note = feynman_map.get(req.feynman_level or "", "")

        return f"{_SYSTEM_PROMPT}\n\n{lang_note}\n{modality_note}\n{feynman_note}"

    @staticmethod
    def generate(req: ChatRequest) -> ChatResponse:
        system = TutorService._system_prompt(req)
        if req.username:
            system += f"\n\nStudent name: {req.username}"

        # Full chain: Groq → Gemini → smart offline fallback.
        reply = _llm_generate(req.message, system=system)
        if reply:
            # Language enforcement: if Arabic was requested but the LLM replied
            # in English, retry with a short Arabic-only system prompt.
            if req.language == "ar" and not _is_arabic_text(reply):
                logger.info("LLM replied in English for Arabic request — retrying with Arabic prompt")
                ar_reply = _llm_generate_ar(req.message)
                if ar_reply and _is_arabic_text(ar_reply):
                    reply = ar_reply
            return ChatResponse(
                sender="bot", text=reply,
                feynman_level=req.feynman_level or "academic",
                modality=req.modality or "visual",
                language=req.language or "en", status="success")

        return _context_aware_fallback(req)

    @staticmethod
    def generate_with_context(req: ChatRequest, context_text: str = "", weak_topics: list[str] = None,
                              grounding_mode: str = "general") -> ChatResponse:
        # Try the real LLM stack first (Groq → Gemini), then the smart offline fallback.
        system = TutorService._system_prompt(req)
        if grounding_mode == "strict":
            system += _STRICT_GROUNDING_PROMPT
        if context_text:
            system += f"\n\nLESSON MATERIAL (the ONLY source you may answer from in strict mode):\n{context_text[:6000]}"
        if weak_topics:
            system += (f"\n\nNOTE: The student struggles with these topics: {', '.join(weak_topics)}. "
                       "Be extra patient and use simpler explanations when these come up.")

        llm_reply = _llm_generate(req.message, system=system, grounding_mode=grounding_mode)
        if llm_reply:
            if grounding_mode == "strict":
                if _llm_refused(llm_reply):
                    return _strict_refusal(req)
                # Accept when the model cites lesson evidence OR the reply is
                # clearly built from the lesson's own vocabulary.
                if not _has_lesson_evidence(llm_reply, context_text) and not _reply_matches_lesson(llm_reply, context_text):
                    return _strict_refusal(req)
                # The evidence tag is an internal contract — never show it raw.
                llm_reply = re.sub(r'\s*\[Lesson evidence:\s*[""\u201c][^""\u201d]{4,240}[""\u201d]\]', '', llm_reply, flags=re.I).strip()
            # Language enforcement: if Arabic was requested but the LLM replied
            # in English, retry with a short Arabic-only system prompt.
            if req.language == "ar" and not _is_arabic_text(llm_reply):
                logger.info("LLM replied in English for Arabic request (RAG) — retrying with Arabic prompt")
                ar_prompt = f"أجب على هذا السؤال بالعامية المصرية: {req.message}"
                if context_text:
                    ar_prompt += f"\n\nسياق الدرس: {context_text[:3000]}"
                ar_reply = _llm_generate_ar(ar_prompt)
                if ar_reply and _is_arabic_text(ar_reply):
                    llm_reply = ar_reply
            return ChatResponse(
                sender="bot", text=llm_reply,
                feynman_level=req.feynman_level or "academic",
                modality=req.modality or "visual",
                language=req.language or "en", status="success")

        return _context_aware_fallback(req, context_text=context_text, weak_topics=weak_topics)
