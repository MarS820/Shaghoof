"""C4: Retention Mechanics endpoints + Question Generation."""
from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional, List

from ..core import store
from ..services import retention, gemini, twin as twin_srv

router = APIRouter(prefix="/api/v1", tags=["retention"])


# ------------------------- Question Generation -------------------------

class QuestionGen(BaseModel):
    user_id: str
    topic: str
    subject: Optional[str] = None
    count: int = 4
    style: Optional[str] = None  # e.g. audio/text/visual
    age: Optional[int] = None  # if not provided, from twin
    difficulty: str = "medium"  # easy | medium | hard
    language: str = "en"  # en | ar
    template_id: Optional[str] = None
    quiz_format: Optional[str] = None


class TranslateIn(BaseModel):
    text: str
    target_lang: str


class TranslateBatchIn(BaseModel):
    texts: List[str]
    target_lang: str


@router.post("/questions/generate")
def generate_questions(req: QuestionGen):
    """Generate AI questions suitable for the student's age and SEN profile."""
    twin_rec = store.ensure(req.user_id)
    age = req.age or twin_rec.get("age", 10)
    genai_style = req.style or "reading"

    # Generate text questions suited to a student age/difficulty/language.
    questions = gemini.generate_questions(
        req.topic, age, genai_style, req.count, req.difficulty, req.language, req.subject,
        template_id=req.template_id, quiz_format=req.quiz_format,
    )

    # Adapt to SEN profile: for blind students prefer auditory phrasing
    sen = [str(f).lower() for f in twin_rec.get("sen_flags", [])]
    adaptation = {}
    if any("blind" in f for f in sen):
        adaptation["mode"] = "audio-first"
    if any("deaf" in f for f in sen):
        adaptation["mode"] = "text-sign"
    if any("motor" in f for f in sen):
        adaptation["mode"] = "reduced-input"

    for q in questions:
        q["id"] = f"{user_qid(req.user_id)}_{q['id']}"
        q["visual_cue"] = _visual_cue(req.subject or req.topic)

    # Record custom topic if one was entered
    custom = req.topic.strip()
    if custom:
        topics = set(twin_rec.get("custom_topics", []))
        topics.add(custom)
        store.update(req.user_id, {"custom_topics": sorted(topics)})

    return {
        "questions": questions,
        "age": age,
        "topic": req.topic,
        "subject": req.subject,
        "style": genai_style,
        "difficulty": req.difficulty,
        "language": req.language,
        "adaptation": adaptation,
    }


@router.post("/translate")
def translate(data: TranslateIn):
    """Translate a piece of text between en/ar using Gemini."""
    target = "ar" if data.target_lang.lower() == "ar" else "en"
    return {"text": gemini.translate_text(data.text, target), "target_lang": target}


@router.post("/translate/batch")
def translate_batch(data: TranslateBatchIn):
    """Translate all visible question content in one reliable request."""
    target = "ar" if data.target_lang.lower() == "ar" else "en"
    return {
        "texts": [gemini.translate_text(text, target) for text in data.texts],
        "target_lang": target,
    }


def user_qid(uid):
    import hashlib
    return hashlib.md5(str(uid).encode()).hexdigest()[:8]


def _visual_cue(topic):
    """A structured cue for the client-side visual learning renderer."""
    text = str(topic or "").lower()
    if any(word in text for word in ("math", "fraction", "equation", "addition", "number")):
        return {"kind": "math", "label": "Number pattern"}
    if any(word in text for word in ("science", "plant", "animal", "water", "space")):
        return {"kind": "science", "label": "Explore the pattern"}
    if any(word in text for word in ("art", "color", "draw", "paint")):
        return {"kind": "art", "label": "Colour relationship"}
    if any(word in text for word in ("read", "story", "language", "english")):
        return {"kind": "reading", "label": "Story sequence"}
    return {"kind": "concept", "label": "Key idea map"}


# ------------------------- Retention -------------------------

class ZeigarnikIn(BaseModel):
    user_id: str
    questions_answered: int = 0
    total: int = 4


@router.post("/retention/zeigarnik")
def zeigarnik(data: ZeigarnikIn):
    """Logout/interruption interception hook."""
    return retention.zeigarnik_hook(data.questions_answered, data.total)


@router.get("/retention/endowed-progress")
def endowed(user_id: str, course: str = ""):
    """Courses start at 15% completion."""
    twin_rec = store.ensure(user_id)
    base = retention.endowed_progress(twin_rec.get("vark"))
    return {
        "course": course,
        "initial_progress": base,
        "message": f"Your course starts at {base}% progress — you're already making headway!",
    }


class SurpriseIn(BaseModel):
    user_id: str
    force: bool = False


@router.post("/retention/surprise")
def surprise(data: SurpriseIn):
    """Scheduled surprises (random agent takeovers like Double XP)."""
    twin_rec = store.ensure(data.user_id)
    event = retention.maybe_surprise(twin_rec, force=data.force)
    store.save(data.user_id, twin_rec)
    if event:
        return {"surprise": event}
    return {"surprise": None}


class EmotionIn(BaseModel):
    user_id: str
    mood: str
    note: str = ""


@router.post("/retention/emotion")
def emotion(data: EmotionIn):
    """Emotion check-in; adapts session based on mood."""
    twin_rec = store.ensure(data.user_id)
    result = retention.emotion_checkin(twin_rec, data.mood.lower(), data.note)
    store.save(data.user_id, twin_rec)
    return result


class BreakIn(BaseModel):
    user_id: str
    active: bool = True


@router.post("/retention/break")
def break_reminder(data: BreakIn):
    """15-minute continuous-work reminder."""
    twin_rec = store.ensure(data.user_id)
    result = retention.check_break_reminder(twin_rec, working=data.active)
    store.save(data.user_id, twin_rec)
    return result


class AffirmationIn(BaseModel):
    user_id: str
    language: str = "en"
    progress_pct: int = 0


@router.post("/retention/affirmations")
def affirmations(data: AffirmationIn):
    """Generate personalized affirmations based on progress + SEN."""
    twin_rec = store.ensure(data.user_id)
    arr = retention.generate_affirmation(twin_rec, data.progress_pct, data.language)
    store.save(data.user_id, twin_rec)
    return {"affirmations": arr}


class LogoutIn(BaseModel):
    user_id: str
    questions_answered: int = 0
    total: int = 4


@router.post("/retention/logout-hook")
def logout_hook(data: LogoutIn):
    """Full retention state dump useful at session end."""
    twin_rec = store.ensure(data.user_id)
    hook = retention.zeigarnik_hook(data.questions_answered, data.total)
    break_rem = retention.check_break_reminder(twin_rec)
    return {
        "zeigarnik": hook,
        "break_reminder": break_rem,
        "affirmation": (twin_rec.get("affirmations") or ["Great job today!"])[-1],
    }
