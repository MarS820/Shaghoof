from fastapi import APIRouter, HTTPException, Response
from ..schemas import (PodcastRequest, PodcastResponse, TTSRequest,
                        FeynmanEvaluateRequest, FeynmanEvaluateResponse,
                        KnowledgeGraphResponse, RAGBenchmarkResponse)
from ..services.championship import ChampionshipService

router = APIRouter(prefix="/championship", tags=["Championship Suite"])


@router.post("/podcast/generate", response_model=PodcastResponse)
def generate_podcast(req: PodcastRequest):
    try:
        return ChampionshipService.generate_podcast(topic=req.topic, language=req.language, dialect=req.dialect)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# NOTE: POST /championship/podcast/tts lives in api/championship.py (rate-limited).


@router.post("/feynman/evaluate", response_model=FeynmanEvaluateResponse)
def evaluate_feynman(req: FeynmanEvaluateRequest):
    try:
        return ChampionshipService.evaluate_feynman(
            topic=req.topic, student_explanation=req.student_explanation, language=req.language,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/graph/concepts", response_model=KnowledgeGraphResponse)
def get_knowledge_graph(course_id: str = "default"):
    return ChampionshipService.get_knowledge_graph(course_id=course_id)


@router.get("/rag/benchmark", response_model=RAGBenchmarkResponse)
def get_rag_benchmark():
    data = ChampionshipService.get_rag_benchmark()
    return RAGBenchmarkResponse(**data)
