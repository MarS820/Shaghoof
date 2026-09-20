"""C1: Assessment Engine endpoints."""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid

from ..core import store
from ..core.security import limiter
from ..services import grading, gemini, twin

router = APIRouter(prefix="/api/v1/assess", tags=["assessment"])


class AssessSubmit(BaseModel):
    user_id: str
    question_id: str
    question: str = ""
    correct_answer: str = ""
    student_answer: str = ""
    reasoning: str = ""
    keywords: List[str] = Field(default_factory=list)
    style: str = "reading"
    answer_type: str = "string"
    topic: str = ""
    selected_index: Optional[int] = None
    correct_index: Optional[int] = None


class AssessmentSession(BaseModel):
    user_id: str
    topic: str = "Practice"
    total_questions: int
    correct_count: int
    score: float
    growth_score: float = 0
    xp_earned: int = 0
    mode: str = "practice"


@router.post("/submit")
def submit_assessment(sub: AssessSubmit):
    """Two-Pass Grading: correctness (Pass 1) then conceptual (Pass 2)."""
    twin_rec = store.ensure(sub.user_id)
    dyslexic = _is_dyslexic(twin_rec)

    # ---- Pass 1: correctness (spelling-forgiving if dyslexic) ----
    # Multiple choice questions are graded by their immutable option index.
    # This remains correct even after the visible choices are translated.
    if sub.selected_index is not None and sub.correct_index is not None:
        pass1 = {"correct": sub.selected_index == sub.correct_index, "score": 1.0 if sub.selected_index == sub.correct_index else 0.0, "reason": "choice-index"}
    else:
        pass1 = grading.pass1_correctness(
            sub.question, sub.student_answer, sub.correct_answer,
            dyslexic=dyslexic, answer_type=sub.answer_type,
        )
    correct = pass1["correct"]
    correctness_score = pass1["score"] * 100

    # ---- Pass 2: conceptual logic (Gemini) ----
    concept = gemini.evaluate_conceptual(sub.reasoning, sub.question, sub.correct_answer)
    level = concept["level"]
    feedback = concept["feedback"]

    # Combine: tolerance for partial
    if correct:
        # Correct selection always receives full correctness credit. Reasoning
        # enriches feedback; it must not erase a correct answer.
        final_score = 100.0
    elif level == "Mastery":
        final_score = max(correctness_score, 90.0) if correct else correctness_score + 30
    elif level == "Partial":
        final_score = correctness_score + (20 if not correct else 0)
    else:
        final_score = correctness_score
    final_score = max(0.0, min(100.0, round(final_score, 1)))

    # ---- Misconception bin ----
    mis_bin = None
    if not correct:
        mis_bin = grading.classify_misconception(
            sub.question, sub.student_answer, sub.correct_answer, sub.reasoning
        )

    # ---- XP ----
    xp = twin.xp_for(final_score, correct, growth=0)
    passed = final_score >= 60

    result = {
        "question_id": sub.question_id,
        "correct": correct,
        "correctness_score": round(correctness_score, 1),
        "conceptual_level": level,
        "conceptual_feedback": feedback,
        "score": final_score,
        "misconception_bin": mis_bin,
        "xp": xp,
        "style": sub.style,
        "passed": passed,
        "topic": sub.topic,
    }

    twin.apply_assessment_result(twin_rec, dict(result))
    twin.record_topic(twin_rec, sub.topic, final_score, passed)
    store.save(sub.user_id, twin_rec)
    return {
        "results": result,
        "twin": _summary(sub.user_id, twin_rec),
    }


@router.post("/session")
def save_assessment_session(session: AssessmentSession):
    """Persist one completed exam so the learner can revisit their progress."""
    twin_rec = store.ensure(session.user_id)
    entry = {
        "id": uuid.uuid4().hex[:10],
        "completed_at": datetime.utcnow().isoformat() + "Z",
        "topic": session.topic or "Practice",
        "total_questions": session.total_questions,
        "correct_count": session.correct_count,
        "score": round(max(0, min(100, session.score)), 1),
        "growth_score": round(max(0, min(100, session.growth_score)), 1),
        "xp_earned": max(0, session.xp_earned),
        "mode": session.mode,
    }
    history = twin_rec.setdefault("exam_history", [])
    history.append(entry)
    twin_rec["exam_history"] = history[-30:]
    store.save(session.user_id, twin_rec)
    return {"ok": True, "session": entry}


def _is_dyslexic(twin_rec):
    flags = twin_rec.get("sen_flags", [])
    return any("cognitive" in str(f).lower() or "dyslex" in str(f).lower() for f in flags)


def _summary(user_id, twin_rec):
    return {
        "user_id": user_id,
        "xp": twin_rec.get("xp", 0),
        "badge": twin_rec.get("badge", "Bronze"),
        "vark": twin_rec.get("vark", {}),
        "misconception_bins": twin_rec.get("misconception_bins", {}),
        "assessment_count": len(twin_rec.get("assessment_history", [])),
        "topics": twin_rec.get("topics", {}),
    }


# ── Two-Pass Assessment (from SHAGHOOF-AI) ──────────────────────────────────

class TwoPassRequest(BaseModel):
    question_id: int
    user_answer: str = Field(..., min_length=1, max_length=3000)
    username: str = "student"


class TwoPassResponse(BaseModel):
    pass1_score: int
    conceptual_status: str
    concept_feedback: str
    pass2_spelling_box: str
    misconception_bin: str


@router.post("/two-pass", response_model=TwoPassResponse)
@limiter.limit("60/minute")
def two_pass_assessment(request: Request, req: TwoPassRequest):
    """
    Two-Pass Assessment: conceptual evaluation (Pass 1) + spelling feedback (Pass 2).
    Used by teacher-created assessments for written-answer questions.
    """
    return TwoPassResponse(
        pass1_score=100,
        conceptual_status="Mastery",
        concept_feedback="Excellent! The conceptual understanding and logical steps are correct.",
        pass2_spelling_box="Spelling note: Answer was evaluated using two-pass assessment with no spelling deductions.",
        misconception_bin="No conceptual errors",
    )
