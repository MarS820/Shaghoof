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
    options: list[str] = Field(description="Exactly 4 answer options.")
    correct_index: int = Field(description="Index (0-3) of the correct option.")
    explanation: str = Field(description="One sentence explaining the correct answer.")

    @field_validator("options")
    @classmethod
    def _must_have_four(cls, v: list[str]) -> list[str]:
        if len(v) != 4:
            raise ValueError("Each question must have exactly 4 options.")
        return v

    @field_validator("correct_index")
    @classmethod
    def _index_in_range(cls, v: int) -> int:
        if not (0 <= v <= 3):
            raise ValueError("correct_index must be between 0 and 3.")
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
You are an expert quiz-writer creating an educational multiple-choice quiz.

Topic: {topic}
Subject: {subject}
Difficulty: {difficulty}
Number of questions: {n}
Seed: {seed}

{context_section}
{adaptation_section}

Rules:
- Write exactly {n} questions about "{topic}" grounded in real, accurate facts.
- Each question has exactly 4 options, only ONE correct.
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


def _fallback(topic: str, n: int, difficulty: str) -> list[dict]:
    bank = [
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
    random.shuffle(bank)
    return [
        {"question": q.format(t=topic), "options": opts, "correct": c,
         "difficulty": difficulty, "explanation": "Fallback question — AI service unavailable."}
        for i, (q, opts, c) in enumerate(bank)
        for _ in [None] if i < n
    ][:n]


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
) -> list[dict]:
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

    if len(context_text.split()) < 20:
        raise ValueError(
            "There is not enough lesson material in this subject to make an accurate quiz. "
            "Generate a lesson from its dedicated source first."
        )

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

    if not key or ChatGroq is None:
        # No Groq key — try Gemini before falling back to the heuristic bank.
        gemini_qs = _gemini_quiz(topic, n, difficulty, subject, adapt_rule, context_text, avoid_section)
        if gemini_qs:
            return gemini_qs[:n], {"vark_mode": vark_mode, "sen_profile": sen_profile, "template_id": adapt["template_id"]}
        raise ValueError("Quiz generation is temporarily unavailable; no ungrounded questions were created.")

    try:
        model = _get_model(key)
        chain = _PROMPT | model
        result: _QuizResponse = chain.invoke({
            "topic": topic,
            "subject": subject or "General",
            "difficulty": difficulty,
            "n": n,
            "seed": random.randint(100000, 999999),
            "avoid_section": avoid_section,
            "context_section": _CONTEXT_RULES.format(context=context_text) if context_text else "",
            "adaptation_section": adaptation_section,
        })
        out = [
            {"question": q.question, "options": q.options, "correct": q.correct_index,
             "difficulty": difficulty, "explanation": q.explanation}
            for q in result.questions[:n]
        ]
        if len(out) < n:
            raise ValueError("The source did not support enough accurate quiz questions. Add more lesson material.")
        return out[:n], {"vark_mode": vark_mode, "sen_profile": sen_profile, "template_id": adapt["template_id"]}
    except Exception as exc:
        logger.warning("Quiz generation via Groq failed, trying Gemini: %s", exc)
        gemini_qs = _gemini_quiz(topic, n, difficulty, subject, adapt_rule, context_text, avoid_section)
        if gemini_qs:
            return gemini_qs[:n], {"vark_mode": vark_mode, "sen_profile": sen_profile, "template_id": adapt["template_id"]}
        raise ValueError("Quiz generation is temporarily unavailable; no ungrounded questions were created.")
