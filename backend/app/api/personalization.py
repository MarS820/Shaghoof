from fastapi import APIRouter, Request
from pydantic import BaseModel, Field
from typing import Optional
from ..services import event_store, personalization, lesson_generator
from ..schemas import LearningInsightsResponse
from ..core.security import limiter

router = APIRouter(prefix="/personalization", tags=["Personalization"])


class TrackEventRequest(BaseModel):
    user_id: str = "default"
    event_type: str = Field(..., min_length=1, max_length=50)
    topic: str = Field(default="", max_length=255)
    score: float = Field(default=0)
    total: float = Field(default=0)
    difficulty: str = Field(default="", max_length=20)
    payload: dict | None = None


@router.post("/track")
@limiter.limit("120/minute")
def track_event(request: Request, req: TrackEventRequest):
    event_store.add_event(
        user_id=req.user_id,
        event_type=req.event_type,
        topic=req.topic,
        score=req.score,
        total=req.total,
        difficulty=req.difficulty,
        payload=req.payload,
    )
    return {"status": "ok"}


@router.get("/insights", response_model=LearningInsightsResponse)
@limiter.limit("30/minute")
def get_insights(request: Request, user_id: str = "default"):
    df = event_store.get_events_dataframe(user_id)
    insights = personalization.get_learning_insights(df)
    return LearningInsightsResponse(**insights)


@router.get("/weak-topics")
@limiter.limit("30/minute")
def get_weak_topics(request: Request, user_id: str = "default"):
    df = event_store.get_events_dataframe(user_id)
    return {"weak_topics": personalization.weak_topics(df)}


@router.get("/strong-topics")
@limiter.limit("30/minute")
def get_strong_topics(request: Request, user_id: str = "default"):
    df = event_store.get_events_dataframe(user_id)
    return {"strong_topics": personalization.strong_topics(df)}


@router.get("/recommendations")
@limiter.limit("30/minute")
def get_recommendations(request: Request, user_id: str = "default"):
    df = event_store.get_events_dataframe(user_id)
    return {"recommendations": personalization.recommendation_plan(df)}


@router.get("/feed")
@limiter.limit("60/minute")
def get_activity_feed(request: Request, user_id: str = "default", limit: int = 8):
    """Real activity feed built strictly from tracked events + saved lessons.
    Never fabricates entries: empty state is returned as-is for honest UI."""
    events = event_store.get_events(user_id)
    feed: list[dict] = []
    for ev in reversed(events[-60:]):
        topic = (ev.get("topic") or "").strip()
        etype = ev.get("event_type", "")
        ts = (ev.get("timestamp") or "")[:16].replace("T", " ")
        if etype == "lesson_generated":
            text = f"New lesson created from your {topic or 'source'}"
            icon = "📖"
        elif etype == "quiz_submitted":
            score, total = ev.get("score", 0), ev.get("total", 0)
            text = f"Quiz on {topic or 'your material'} — {score}/{total} correct"
            icon = "📝"
        elif etype == "tutor_chat":
            text = f"Asked the tutor about {topic or 'a topic'}"
            icon = "💬"
        elif etype == "video_generated":
            text = f"Video lesson generated for {topic or 'a lesson'}"
            icon = "🎬"
        elif etype == "emotion_checkin":
            text = f"Mood check-in: {ev.get('payload', {}).get('mood', 'logged')}"
            icon = "💚"
        else:
            text = f"{etype.replace('_', ' ')}{f' — {topic}' if topic else ''}"
            icon = "⭐"
        feed.append({"id": f"{ev.get('timestamp', '')}_{etype}", "icon": icon, "text": text, "at": ts})

    lessons = lesson_generator.list_user_lessons(user_id=user_id)
    return {
        "feed": feed[: max(1, min(limit, 30))],
        "lesson_count": len(lessons),
        "event_count": len(events),
    }
