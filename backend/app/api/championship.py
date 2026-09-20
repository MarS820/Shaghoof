"""Championship & Academic Rigor Suite — Podcast, TTS, Feynman, Knowledge Graph, RAG Benchmark."""

from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel, Field
from ..services.championship import ChampionshipService
from ..core.security import limiter


router = APIRouter(prefix="/championship", tags=["Championship Suite"])


class PodcastRequest(BaseModel):
    topic: str = Field(..., example="Backpropagation and Gradient Descent")
    language: str = Field("ar", example="ar")
    dialect: bool = Field(True, example=True)


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, example="أهلاً بكم في بودكاست شغوف...")
    speaker: str = Field("host1", example="host1")
    language: str = Field("ar", example="ar")
    dialect: bool = Field(True, example=True)
    speed: float = Field(1.0, example=1.0)
    engine: str = Field("azure", example="azure")


class FeynmanRequest(BaseModel):
    topic: str = Field(..., example="Backpropagation")
    student_explanation: str = Field(..., min_length=5, example="تخيل إن الموديل زي طفل بيتعلم...")
    language: str = Field("ar", example="ar")


@router.post("/podcast/generate")
@limiter.limit("10/minute")
def generate_podcast(request, req: PodcastRequest):
    """Generate NotebookLM-style two-speaker conversational podcast overview."""
    try:
        return ChampionshipService.generate_podcast(
            topic=req.topic, language=req.language, dialect=req.dialect
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/podcast/tts")
@limiter.limit("20/minute")
async def synthesize_podcast_audio(request, req: TTSRequest):
    """Synthesize high-fidelity audio using unified neural voices (Azure or Google TTS)."""
    try:
        audio_bytes = await ChampionshipService.synthesize_speech(
            text=req.text, speaker=req.speaker, language=req.language,
            dialect=req.dialect, speed=req.speed, engine=req.engine,
        )
        if not audio_bytes:
            raise HTTPException(status_code=500, detail="Audio synthesis produced empty stream")
        return Response(content=audio_bytes, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS synthesis error: {e}")


@router.get("/rag/benchmark")
@limiter.limit("30/minute")
def get_rag_benchmark(request):
    """Returns quantitative RAG Triad & Ragas standard scientific benchmark metrics."""
    try:
        return ChampionshipService.get_rag_benchmark()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/feynman/evaluate")
@limiter.limit("10/minute")
def evaluate_feynman(request, req: FeynmanRequest):
    """Evaluates student's plain-language explanation (Reverse Feynman Challenge)."""
    try:
        return ChampionshipService.evaluate_feynman(
            topic=req.topic, student_explanation=req.student_explanation, language=req.language
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/graph/concepts")
@limiter.limit("30/minute")
def get_concept_graph(request, course_id: str = Query("default")):
    """Returns nodes and edges for 3D/Force-directed Knowledge Graph visualization."""
    try:
        return ChampionshipService.get_knowledge_graph(course_id=course_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
