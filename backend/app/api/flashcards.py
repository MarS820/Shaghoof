from fastapi import APIRouter, Request
from ..schemas import FlashcardGenerateRequest, FlashcardGenerateResponse, FlashcardOut
from ..services.flashcards import generate_flashcards
from ..core.security import limiter

router = APIRouter(prefix="/flashcards", tags=["Flashcard Generation"])


@router.post("/generate", response_model=FlashcardGenerateResponse)
@limiter.limit("30/minute")
def flashcard_generate(request: Request, req: FlashcardGenerateRequest):
    cards = generate_flashcards(topic=req.topic, n=req.n, weak_topics=req.weak_topics)
    return FlashcardGenerateResponse(cards=[FlashcardOut(**c) for c in cards], topic=req.topic)
