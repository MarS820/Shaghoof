from fastapi import APIRouter, Request
from ..schemas import AssignmentGenerateRequest, AssignmentGenerateResponse
from ..services.assignments import generate_assignment
from ..core.security import limiter

router = APIRouter(prefix="/assignments", tags=["Assignment Generation"])


@router.post("/generate", response_model=AssignmentGenerateResponse)
@limiter.limit("15/minute")
def assignment_generate(request: Request, req: AssignmentGenerateRequest):
    result = generate_assignment(
        topic=req.topic, source=req.source, student_level=req.student_level,
        assignment_type=req.assignment_type, difficulty=req.difficulty, count=req.count,
    )
    return AssignmentGenerateResponse(assignment=result, topic=req.topic, status="success")
