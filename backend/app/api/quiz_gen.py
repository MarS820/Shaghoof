from fastapi import APIRouter, HTTPException, Request
from ..schemas import QuizGenerateRequest, QuizGenerateResponse, QuizQuestionOut
from ..services.quiz_generation import generate_quiz
from ..core.security import limiter

router = APIRouter(prefix="/quiz", tags=["Quiz Generation"])


@router.post("/generate", response_model=QuizGenerateResponse)
@limiter.limit("30/minute")
def quiz_generate(request: Request, req: QuizGenerateRequest):
    try:
        questions, adaptation = generate_quiz(
            topic=req.topic, n=req.n, difficulty=req.difficulty,
            subject=req.subject, avoid=req.avoid,
            user_id=req.user_id,
            ground_in_lessons=req.ground_in_lessons,
            vark_mode=req.vark_mode,
            sen_profile=req.sen_profile,
            question_types=req.question_types,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return QuizGenerateResponse(
        questions=[QuizQuestionOut(**q) for q in questions],
        topic=req.topic, difficulty=req.difficulty,
        adaptation=adaptation,
    )
