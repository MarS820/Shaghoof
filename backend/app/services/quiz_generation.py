from __future__ import annotations
import os
import random
import logging
from typing import Optional

from pydantic import BaseModel, Field, field_validator
from ..core.config import settings

logger = logging.getLogger(__name__)

try:
    from langchain_groq import ChatGroq
    from langchain_core.prompts import ChatPromptTemplate
except ImportError:
    ChatGroq = None  # type: ignore[assignment]
    ChatPromptTemplate = None  # type: ignore[assignment,misc]


class _QuizQuestion(BaseModel):
    question: str = Field(description="The quiz question text.")
    type: str = Field(default="mcq", description="mcq | true_false | fill_blank | short_answer")
    options: list[str] = Field(default_factory=list, description="Answer options (MCQ/true_false).")
    correct_index: int | None = Field(default=None, description="Index of the correct option (MCQ/true_false).")
    correct_answer: str | None = Field(default=None, description="Canonical answer for fill_blank/short_answer.")
    accepted_answers: list[str] = Field(default_factory=list, description="Accepted answers for fill/short.")
    explanation: str = Field(default="", description="One sentence explaining the correct answer.")

    @field_validator("type")
    @classmethod
    def _known_type(cls, v: str) -> str:
        allowed = {"mcq", "true_false", "fill_blank", "short_answer"}
        if v not in allowed:
            raise ValueError(f"type must be one of {sorted(allowed)}")
        return v

    @field_validator("options")
    @classmethod
    def _options_ok(cls, v: list[str], info) -> list[str]:
        qtype = (info.data or {}).get("type", "mcq")
        if qtype == "mcq" and len(v) != 4:
            raise ValueError("MCQ questions must have exactly 4 options.")
        if qtype == "true_false" and len(v) != 2:
            raise ValueError("true_false questions need exactly 2 options.")
        return v

    @field_validator("correct_index")
    @classmethod
    def _index_ok(cls, v: int | None, info) -> int | None:
        qtype = (info.data or {}).get("type", "mcq")
        if qtype in ("mcq", "true_false"):
            if v is None:
                raise ValueError("correct_index required for choice questions")
            max_i = 3 if qtype == "mcq" else 1
            if not (0 <= v <= max_i):
                raise ValueError(f"correct_index must be between 0 and {max_i}")
        return v


class _QuizResponse(BaseModel):
    questions: list[_QuizQuestion]


def _gemini_quiz(topic: str, n: int, difficulty: str, subject: Optional[str],
                 adapt_rule: str, context_text: str, avoid_section: str) -> list[dict] | None:
    """Gemini fallback path for quiz generation (used when no Groq key)."""
    try:
        from . import gemini
        if not gemini.ai_available():
            return None
        prompt = f"""You are an expert quiz-writer. Write {n} multiple-choice questions.

Topic: {topic}
Subject: {subject or 'General'}
Difficulty: {difficulty}
{adapt_rule}
{"STRICT GROUNDING — every question MUST be answerable from this material only:\n" + context_text[:3500] if context_text else ''}
{avoid_section}

Return ONLY a JSON array (no markdown fences) of objects:
[{{"question": "...", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "one sentence"}}]

- Exactly 4 options per question, only ONE correct (index 0-3).
- Distractors plausible and topic-relevant. No repeated questions."""
        raw = gemini._generate(prompt)
        if not raw:
            return None
        parsed = gemini.safe_parse_json(raw)
        if not isinstance(parsed, list):
            return None
        out = []
        for q in parsed[:n]:
            opts = q.get("options") or []
            if not isinstance(opts, list) or len(opts) != 4:
                continue
            ci = q.get("correct", 0)
            if not isinstance(ci, int) or not (0 <= ci <= 3):
                continue
            out.append({
                "question": str(q.get("question", ""))[:500],
                "options": [str(o)[:300] for o in opts],
                "correct": ci,
                "difficulty": difficulty,
                "explanation": str(q.get("explanation", ""))[:400],
            })
        return out or None
    except Exception as exc:
        logger.warning("Gemini quiz fallback failed: %s", exc)
        return None


_CACHE: dict = {}


def _get_model(api_key: str):
    if api_key in _CACHE:
        return _CACHE[api_key]
    model_name = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    base = ChatGroq(model=model_name, temperature=0.7, max_tokens=2048,
                    model_kwargs={"top_p": 0.95}, api_key=api_key)
    structured = base.with_structured_output(_QuizResponse)
    _CACHE[api_key] = structured
    return structured


_PROMPT = ChatPromptTemplate.from_template("""\
You are an expert quiz-writer creating an educational quiz with MIXED question types.

Topic: {topic}
Subject: {subject}
Difficulty: {difficulty}
Number of questions: {n}
Allowed question types (one per question, use this exact list in order if possible): {qtypes}
Seed: {seed}

{context_section}
{adaptation_section}

Rules:
- Write exactly {n} questions about "{topic}" grounded in real, accurate facts.
- For each question set "type" to exactly one of: mcq, true_false, fill_blank, short_answer.
- mcq: exactly 4 options, field "correct" = 0-3 index of the right option, "options" has 4 strings.
- true_false: "options" = ["True","False"], "correct" = 0 for True or 1 for False.
- fill_blank: put the answer in "correct_answer" (and 1-3 variants in "accepted_answers"); "options" = []; "correct" = null. The stem must contain a blank "________".
- short_answer: put a short canonical answer in "correct_answer" plus keyword "accepted_answers"; "options" = []; "correct" = null. Keep answers to a short phrase.
- Distractors must be plausible and topic-relevant.
- Difficulty: Easy = recall, Medium = applying concepts, Hard = multi-step reasoning.
- No repeated questions.
- Provide a one-sentence explanation for each correct answer.
{avoid_section}
""")

# VARK + SEN adaptation of the QUIZ ITSELF (master plan: quizzes must follow
# the same template as lessons, not just the content pages).
_VARK_RULES: dict[str, str] = {
    "visual": "VISUAL learner: describe scenarios in picturable terms (scenes, layouts, "
              "before/after states). Prefer 'Which diagram/sequence matches...' phrasing. "
              "Include questions about visual relationships, spatial layouts, and sequences.",
    "auditory": "AUDITORY learner: phrase questions conversationally, as if spoken aloud. "
                "Rhythm matters; keep wording natural to say out loud. "
                "Include questions about sounds, spoken explanations, and verbal sequences.",
    "reading": "READING/WRITING learner: precise, formal wording. Definitions, lists and "
               "note-style stems are welcome. "
               "Include questions about written content, definitions, and structured information.",
    "kinesthetic": "KINESTHETIC learner: frame every question as a DOING scenario — a task, "
                   "experiment, or hands-on situation the student must complete. "
                   "Include questions about physical actions, experiments, and practical applications.",
}

_SEN_RULES: dict[str, str] = {
    "text": "TEXT SUPPORT overlay: short sentences (max 14 words), simple everyday vocabulary, "
            "no double negatives, define any technical term inside the question itself. "
            "Use clear, direct language without complex sentence structures.",
    "focus": "FOCUS overlay: each question tests exactly ONE idea. No multi-step stems, no "
             "option lists longer than 4, keep the whole question under 25 words. "
             "Use clear, concise language with minimal cognitive load.",
    "structure": "STRUCTURE overlay: use a predictable question skeleton (every stem has the "
                 "same shape), literal language only, no idioms, metaphors or trick wording. "
                 "Maintain consistent question format throughout the quiz.",
    "general": "",
}

# Template-specific quiz format rules (maps to the 6 core UI templates)
_TEMPLATE_QUIZ_RULES: dict[str, str] = {
    "T1": "T1 SANDBOX format: Questions should be hands-on, practical scenarios. "
          "Focus on application and experimentation. Use action-oriented language.",
    "T2": "T2 PODCAST format: Questions should be conversational and auditory-friendly. "
          "Phrase as if spoken aloud. Include questions about spoken explanations.",
    "T3": "T3 STORYBOARD format: Questions should be visual and sequential. "
          "Focus on diagrams, sequences, and visual relationships.",
    "T4": "T4 TRANSLATOR format: Questions should be precise and definition-focused. "
          "Include vocabulary and structured information questions.",
    "T5": "T5 EXPLORER format: Questions should be visual and interactive. "
          "Focus on diagrams, practical applications, and hands-on scenarios.",
    "T6": "T6 ROUTINE format: Questions should be structured and predictable. "
          "Use consistent question formats and literal language.",
}

# When the student has lessons, ground every question in their actual material.
_CONTEXT_RULES = (
    "STRICT GROUNDING — the student's own lesson material is provided below. "
    "Every question and every option MUST be answerable from this material only. "
    "Do not use outside knowledge. Quote the material's terminology and examples:\n"
    "--- LESSON MATERIAL START ---\n{context}\n--- LESSON MATERIAL END ---\n"
)


# Template → preferred non-MCQ question mix (MCQ always allowed as base).
TEMPLATE_QUESTION_TYPES: dict[str, list[str]] = {
    "T1": ["mcq", "true_false"],                 # Sandbox: quick hands-on checks
    "T2": ["mcq", "fill_blank"],                 # Podcast: heard words filled in
    "T3": ["mcq", "true_false"],                 # Storyboard: sequential T/F + choice
    "T4": ["fill_blank", "short_answer", "mcq"], # Translator: definitions & wording
    "T5": ["mcq", "true_false", "fill_blank"],   # Explorer: mixed discovery
    "T6": ["mcq", "true_false", "fill_blank"],   # Routine: predictable mixed
}

VALID_QTYPES = ("mcq", "true_false", "fill_blank", "short_answer")


def _resolve_question_types(
    requested: Optional[list[str]],
    template_id: str,
    n: int,
) -> list[str]:
    """Return a length-n list of question types, mixed by template."""
    if requested:
        pool = [t for t in requested if t in VALID_QTYPES] or ["mcq"]
    else:
        pool = TEMPLATE_QUESTION_TYPES.get(template_id, ["mcq"])
    if len(pool) == 1:
        return [pool[0]] * n
    # Round-robin so short quizzes still see variety when n >= 2
    return [pool[i % len(pool)] for i in range(n)]


def _normalize_q(q: dict, difficulty: str) -> dict:
    """Coerce a generated/parsed question into the wire shape."""
    qtype = str(q.get("type") or "mcq")
    if qtype not in VALID_QTYPES:
        qtype = "mcq"
    options = q.get("options") or []
    if not isinstance(options, list):
        options = []
    options = [str(o)[:300] for o in options]

    correct = q.get("correct", q.get("correct_index"))
    if isinstance(correct, str) and correct.isdigit():
        correct = int(correct)
    if not isinstance(correct, int):
        correct = None

    correct_answer = q.get("correct_answer")
    accepted = q.get("accepted_answers") or []
    if not isinstance(accepted, list):
        accepted = []

    # True/false normalisation
    if qtype == "true_false":
        if not options:
            options = ["True", "False"]
        if correct is None and correct_answer:
            ca = str(correct_answer).strip().lower()
            correct = 0 if ca in ("true", "t", "yes", "صح", "صحيح") else 1
            correct_answer = options[correct]
        if correct is None:
            correct = 0
            correct_answer = options[0]
        elif not correct_answer and 0 <= correct < len(options):
            correct_answer = options[correct]

    if qtype == "mcq":
        if len(options) != 4:
            return {}  # unusable
        if correct is None or not (0 <= correct <= 3):
            return {}
        correct_answer = options[correct]

    if qtype in ("fill_blank", "short_answer"):
        options = []
        correct = None
        if not correct_answer:
            # Try to pull from options/correct if the model mixed shapes
            if options:
                correct_answer = options[0]
        if not correct_answer:
            return {}
        if not accepted:
            accepted = [str(correct_answer)]
        # Also accept the raw answer
        if str(correct_answer) not in accepted:
            accepted = [str(correct_answer), *accepted]

    return {
        "question": str(q.get("question", ""))[:500],
        "type": qtype,
        "options": options,
        "correct": correct,
        "correct_answer": str(correct_answer) if correct_answer is not None else None,
        "accepted_answers": [str(a)[:300] for a in accepted],
        "difficulty": difficulty,
        "explanation": str(q.get("explanation", ""))[:400],
    }


def _mixed_fallback(topic: str, n: int, difficulty: str, types: list[str]) -> list[dict]:
    """Offline bank covering all four question types."""
    mcq_bank = [
        ("What is the primary purpose of {t}?",
         ["Foundational concept", "Unrelated trivia", "A historical footnote", "None of the above"], 0),
        ("Which best describes a core principle of {t}?",
         ["Randomness only", "Structured, testable logic", "Pure opinion", "Irrelevant data"], 1),
        ("In {t}, which approach is most commonly used?",
         ["Guessing", "Systematic methodology", "Ignoring context", "Avoiding practice"], 1),
        ("A key application of {t} in real life is:",
         ["Everyday problem solving", "Nothing practical", "Only theoretical", "Fictional use only"], 0),
        ("Which statement about {t} is FALSE?",
         ["It has real-world relevance", "It can be studied", "It has no structure", "It is taught in schools"], 2),
        ("What skill is most improved by studying {t}?",
         ["Critical thinking", "Forgetting details", "Avoiding practice", "None"], 0),
    ]
    tf_bank = [
        ("{t} can be studied systematically.", True),
        ("Understanding {t} has no real-world use.", False),
        ("Practice improves skill in {t}.", True),
        ("{t} is only about memorising random facts.", False),
        ("Feedback helps you improve at {t}.", True),
        ("{t} requires zero effort to master.", False),
    ]
    fill_bank = [
        ("The main idea behind {t} is ________ .", "structure", ["structure", "structure/system", "system"]),
        ("A common method in {t} is systematic ________ .", "practice", ["practice", "practice/method"]),
        ("Studying {t} builds critical ________ .", "thinking", ["thinking", "thinking skills"]),
        ("Real applications of {t} include everyday problem ________ .", "solving", ["solving", "solving."]),
    ]
    short_bank = [
        ("In one sentence, what is {t}?",
         "A systematic area of study with practical applications.",
         ["systematic", "study", "practice", "application"]),
        ("Give one real-life use of {t}.",
         "Everyday problem solving using its principles.",
         ["problem", "real", "practice", "application"]),
        ("Why is practice important in {t}?",
         "Practice builds skill through repeated feedback.",
         ["practice", "feedback", "skill", "improve"]),
    ]

    out = []
    for i, t in enumerate(types):
        if t == "mcq":
            q, opts, c = mcq_bank[i % len(mcq_bank)]
            out.append(_normalize_q({
                "question": q.format(t=topic), "type": "mcq",
                "options": opts, "correct": c,
                "explanation": "Fallback question — AI service unavailable.",
            }, difficulty))
        elif t == "true_false":
            stmt, ans = tf_bank[i % len(tf_bank)]
            out.append(_normalize_q({
                "question": stmt.format(t=topic), "type": "true_false",
                "options": ["True", "False"], "correct": 0 if ans else 1,
                "explanation": "Fallback question — AI service unavailable.",
            }, difficulty))
        elif t == "fill_blank":
            tmpl, ans, acc = fill_bank[i % len(fill_bank)]
            out.append(_normalize_q({
                "question": tmpl.format(t=topic), "type": "fill_blank",
                "correct_answer": ans, "accepted_answers": acc,
                "explanation": "Fallback question — AI service unavailable.",
            }, difficulty))
        else:
            tmpl, ans, keys = short_bank[i % len(short_bank)]
            out.append(_normalize_q({
                "question": tmpl.format(t=topic), "type": "short_answer",
                "correct_answer": ans, "accepted_answers": keys,
                "explanation": "Fallback question — AI service unavailable.",
            }, difficulty))
    return [q for q in out if q][:n]


def _fallback(topic: str, n: int, difficulty: str) -> list[dict]:
    types = ["mcq"] * n
    return _mixed_fallback(topic, n, difficulty, types)


def _user_adaptation(user_id: Optional[str]) -> dict:
    """Resolve the student's active VARK mode + SEN overlay (same source as lessons)."""
    try:
        from ..core import store
        from .lesson_generator import _pick_template_id
        twin = store.load(user_id or "")
        if twin:
            vark = twin.get("vark") or {}
            scores = {k: float(vark.get(k, 0) or 0) for k in ("visual", "auditory", "reading", "kinesthetic")}
            mode = max(scores, key=scores.get) if any(v > 0 for v in scores.values()) else "visual"
            profile = twin.get("sen_profile") or "general"
            return {"mode": mode, "profile": profile, "template_id": _pick_template_id(mode, profile)}
    except Exception:
        pass
    return {"mode": "visual", "profile": "general", "template_id": "T3"}


def generate_quiz(
    topic: str,
    n: int = 5,
    difficulty: str = "Medium",
    subject: Optional[str] = None,
    avoid: Optional[list[str]] = None,
    api_key: Optional[str] = None,
    user_id: Optional[str] = None,
    ground_in_lessons: bool = False,
    vark_mode: Optional[str] = None,
    sen_profile: Optional[str] = None,
    question_types: Optional[list[str]] = None,
) -> tuple[list[dict], dict]:
    topic = (topic or "").strip()
    if not topic:
        raise ValueError("`topic` must be a non-empty string.")
    if not ground_in_lessons:
        raise ValueError("Quizzes must be generated from a saved lesson. Open or generate a lesson first.")
    if not user_id:
        raise ValueError("A learner profile is required to generate a source-grounded quiz.")
    if not subject:
        raise ValueError("Choose a subject so the quiz can use only that subject's lessons.")
    n = max(1, min(int(n), 20))
    difficulty = difficulty if difficulty in ("Easy", "Medium", "Hard") else "Medium"

    # Template adaptation: explicit request wins, otherwise the student's profile.
    adapt = _user_adaptation(user_id)
    vark_mode = vark_mode or adapt["mode"]
    sen_profile = sen_profile or adapt["profile"]
    qtype_plan = _resolve_question_types(question_types, adapt.get("template_id", "T3"), n)
    qtypes_str = ", ".join(dict.fromkeys(qtype_plan))  # unique, ordered

    key = api_key or settings.GROQ_API_KEY or os.getenv("GROQ_API_KEY", "")

    avoid_section = ""
    if avoid:
        items = "\n".join(f"- {q}" for q in avoid[-30:])
        avoid_section = (
            "\nThe learner has already seen these questions — "
            f"write a DIFFERENT set:\n{items}\n"
        )

    # Collect the student's real lesson material for this subject/topic.
    context_text = ""
    if ground_in_lessons and user_id:
        try:
            from . import lesson_generator
            lessons = lesson_generator.list_user_lessons(user_id=user_id)
            subject_lessons = [l for l in lessons if (l.get("subject") or "") == subject]
            relevant = [
                l for l in lessons
                if (l.get("subject") or "") == subject
                and (not topic or topic.lower() in (l.get("title", "") + " " + l.get("summary", "")).lower())
            ] or subject_lessons
            parts = []
            for meta in relevant[:3]:
                detail = lesson_generator.get_lesson(meta.get("session_id", ""), user_id)
                if not detail:
                    continue
                body = " ".join(s.get("text", "") for s in detail.get("sections", []))
                parts.append(f"[{detail.get('title', '')}] {body[:3500]}")
            context_text = "\n\n".join(parts)
        except Exception as exc:
            logger.warning("Lesson context collection failed: %s", exc)
            context_text = ""

    adapt_rule = "\n".join(
        rule for rule in [
            _VARK_RULES.get(vark_mode, ""),
            _SEN_RULES.get(sen_profile, ""),
            _TEMPLATE_QUIZ_RULES.get(adapt.get("template_id", ""), ""),
        ] if rule
    )
    adaptation_section = (
        f"ADAPT THE QUESTIONS TO THIS LEARNER PROFILE:\n{adapt_rule}\n" if adapt_rule else ""
    )
    adaptation_out = {
        "vark_mode": vark_mode, "sen_profile": sen_profile,
        "template_id": adapt["template_id"],
    }

    # Grounding is preferred but not absolute — still allow AI quizzes when
    # lesson material is thin so students can practice (fallback bank if no AI).
    if len(context_text.split()) < 20:
        context_text = context_text or ""
        # Non-grounded path: still try AI with topic only.
        if not key or ChatGroq is None:
            gemini_qs = _gemini_quiz(topic, n, difficulty, subject, adapt_rule, context_text, avoid_section)
            if gemini_qs:
                # Force types onto gemini MCQ output where needed
                typed = []
                for i, q in enumerate(gemini_qs[:n]):
                    want = qtype_plan[i] if i < len(qtype_plan) else "mcq"
                    if want == "mcq":
                        typed.append(_normalize_q({**q, "type": "mcq"}, difficulty))
                    else:
                        # convert MCQ stem to requested type when AI only gave MCQ
                        fb = _mixed_fallback(topic, 1, difficulty, [want])[0]
                        fb["question"] = q.get("question", fb["question"])
                        fb["explanation"] = q.get("explanation", fb["explanation"])
                        typed.append(fb)
                return [t for t in typed if t][:n], adaptation_out
            return _mixed_fallback(topic, n, difficulty, qtype_plan), adaptation_out

        try:
            model = _get_model(key)
            chain = _PROMPT | model
            result: _QuizResponse = chain.invoke({
                "topic": topic,
                "subject": subject or "General",
                "difficulty": difficulty,
                "n": n,
                "qtypes": qtypes_str,
                "seed": random.randint(100000, 999999),
                "avoid_section": avoid_section,
                "context_section": _CONTEXT_RULES.format(context=context_text) if context_text else "",
                "adaptation_section": adaptation_section,
            })
            out = []
            for i, q in enumerate(result.questions[:n]):
                want = qtype_plan[i] if i < len(qtype_plan) else q.type
                raw = {
                    "question": q.question,
                    "type": q.type or want,
                    "options": q.options or [],
                    "correct": q.correct_index,
                    "correct_answer": q.correct_answer,
                    "accepted_answers": q.accepted_answers or [],
                    "explanation": q.explanation,
                }
                # If model ignored requested type, coerce via fallback with same stem
                if raw["type"] != want and want != "mcq":
                    fb = _mixed_fallback(topic, 1, difficulty, [want])[0]
                    fb["question"] = q.question
                    fb["explanation"] = q.explanation
                    out.append(fb)
                    continue
                norm = _normalize_q(raw, difficulty)
                if norm:
                    out.append(norm)
            if not out:
                out = _mixed_fallback(topic, n, difficulty, qtype_plan)
            return out[:n], adaptation_out
        except Exception as exc:
            logger.warning("Quiz generation via Groq failed, trying Gemini: %s", exc)
            gemini_qs = _gemini_quiz(topic, n, difficulty, subject, adapt_rule, context_text, avoid_section)
            if gemini_qs:
                typed = []
                for i, q in enumerate(gemini_qs[:n]):
                    want = qtype_plan[i] if i < len(qtype_plan) else "mcq"
                    if want == "mcq":
                        typed.append(_normalize_q({**q, "type": "mcq"}, difficulty))
                    else:
                        fb = _mixed_fallback(topic, 1, difficulty, [want])[0]
                        fb["question"] = q.get("question", fb["question"])
                        fb["explanation"] = q.get("explanation", fb["explanation"])
                        typed.append(fb)
                return [t for t in typed if t][:n], adaptation_out
            return _mixed_fallback(topic, n, difficulty, qtype_plan), adaptation_out

    # Full grounded path with lesson material
    if not key or ChatGroq is None:
        gemini_qs = _gemini_quiz(topic, n, difficulty, subject, adapt_rule, context_text, avoid_section)
        if gemini_qs:
            typed = []
            for i, q in enumerate(gemini_qs[:n]):
                want = qtype_plan[i] if i < len(qtype_plan) else "mcq"
                if want == "mcq":
                    typed.append(_normalize_q({**q, "type": "mcq"}, difficulty))
                else:
                    fb = _mixed_fallback(topic, 1, difficulty, [want])[0]
                    fb["question"] = q.get("question", fb["question"])
                    fb["explanation"] = q.get("explanation", fb["explanation"])
                    typed.append(fb)
            return [t for t in typed if t][:n], adaptation_out
        raise ValueError("Quiz generation is temporarily unavailable; no ungrounded questions were created.")

    try:
        model = _get_model(key)
        chain = _PROMPT | model
        result = chain.invoke({
            "topic": topic,
            "subject": subject or "General",
            "difficulty": difficulty,
            "n": n,
            "qtypes": qtypes_str,
            "seed": random.randint(100000, 999999),
            "avoid_section": avoid_section,
            "context_section": _CONTEXT_RULES.format(context=context_text) if context_text else "",
            "adaptation_section": adaptation_section,
        })
        out = []
        for i, q in enumerate(result.questions[:n]):
            want = qtype_plan[i] if i < len(qtype_plan) else q.type
            raw = {
                "question": q.question,
                "type": q.type or want,
                "options": q.options or [],
                "correct": q.correct_index,
                "correct_answer": q.correct_answer,
                "accepted_answers": q.accepted_answers or [],
                "explanation": q.explanation,
            }
            if raw["type"] != want and want != "mcq":
                fb = _mixed_fallback(topic, 1, difficulty, [want])[0]
                fb["question"] = q.question
                fb["explanation"] = q.explanation
                out.append(fb)
                continue
            norm = _normalize_q(raw, difficulty)
            if norm:
                out.append(norm)
        if len(out) < n:
            # Top up with fallback so the student always gets n questions
            extra = _mixed_fallback(topic, n - len(out), difficulty, qtype_plan[len(out):] or ["mcq"])
            out.extend(extra)
        return out[:n], adaptation_out
    except Exception as exc:
        logger.warning("Quiz generation via Groq failed, trying Gemini: %s", exc)
        gemini_qs = _gemini_quiz(topic, n, difficulty, subject, adapt_rule, context_text, avoid_section)
        if gemini_qs:
            typed = []
            for i, q in enumerate(gemini_qs[:n]):
                want = qtype_plan[i] if i < len(qtype_plan) else "mcq"
                if want == "mcq":
                    typed.append(_normalize_q({**q, "type": "mcq"}, difficulty))
                else:
                    fb = _mixed_fallback(topic, 1, difficulty, [want])[0]
                    fb["question"] = q.get("question", fb["question"])
                    fb["explanation"] = q.get("explanation", fb["explanation"])
                    typed.append(fb)
            return [t for t in typed if t][:n], adaptation_out
        # Last resort: offline mixed bank (still respects lesson-grounding intent
        # by only using the topic label — AI is down).
        return _mixed_fallback(topic, n, difficulty, qtype_plan), adaptation_out
