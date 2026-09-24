"""C2: Stretch Zone Module endpoints."""
from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import List

from ..core import store
from ..services import grading, twin as twin_srv, gemini

router = APIRouter(prefix="/api/v1/assess", tags=["stretch"])


class StretchGen(BaseModel):
    user_id: str
    topic: str
    count: int = 3
    style: str = None  # optional; if None use weakest style


class StretchSubmit(BaseModel):
    user_id: str
    question_id: str
    student_answer: str
    keywords: List[str] = Field(default_factory=list)
    topic: str = ""
    style: str = "reading"
    age: int = 10


@router.post("/stretch/generate")
def generate_stretch(req: StretchGen):
    """Generate stretch assessment in the student's weakest VARK style."""
    twin_rec = store.ensure(req.user_id)
    style = req.style or grading.weakest_style(twin_rec.get("vark", {}))
    age = twin_rec.get("age", 10)
    questions = gemini.generate_questions(req.topic, age, style, req.count)
    return {
        "weakest_style": style,
        "style_label": style.capitalize(),
        "questions": questions,
    }


@router.post("/stretch")
def submit_stretch(sub: StretchSubmit):
    """Submit a stretch answer; returns growth score (0-100)."""
    twin_rec = store.ensure(sub.user_id)
    growth = grading.lenient_grade(sub.student_answer, sub.keywords)
    gscore = growth["score"]

    # Growth feedback classification
    if gscore >= 85:
        growth_feedback = "Excellent concept capture! You deeply understood the key ideas."
    elif gscore >= 60:
        growth_feedback = "Great Attempt! You captured the core concepts. Minor gaps remain."
    elif gscore >= 35:
        growth_feedback = "Good start! Try to include more key ideas from the material."
    else:
        growth_feedback = "Keep trying! Review the lesson and attempt again with more detail."

    # Update twin: growth influences the weakest style
    twin_srv.update_vark(twin_rec, sub.style, gscore)
    xp = twin_srv.xp_for(gscore, growth["passed"], growth=gscore)
    twin_srv.add_xp(twin_rec, xp)

    # Retention schedule
    twin_srv.next_review_interval(twin_rec, sub.question_id, growth["passed"])
    twin_srv.record_topic(twin_rec, sub.topic, gscore, growth["passed"])

    store.save(sub.user_id, twin_rec)
    try:
        from ..services.enrollment_sync import sync_twin_to_enrollments
        sync_twin_to_enrollments(sub.user_id, twin_rec)
    except Exception:
        pass
    return {
        "growth_score": gscore,
        "passed": growth["passed"],
        "label": growth["label"],
        "captured_keywords": growth["captured_keywords"],
        "feedback": growth_feedback,
        "xp": xp,
        "message": f"Mastery: {round(gscore,1)}% Growth: {round(gscore,1)}%",
        "twin": {
            "xp": twin_rec.get("xp", 0),
            "badge": twin_rec.get("badge"),
            "vark": twin_rec.get("vark"),
        },
    }
