from fastapi import APIRouter, HTTPException, Request
from ..schemas import ChatRequest, ChatResponse
from ..services.tutor import TutorService
from ..services import lesson_generator
from ..core.security import limiter

router = APIRouter(prefix="/chat", tags=["Tutor Chat Engine"])


def _lesson_context(session_id: str | None, user_id: str) -> tuple[str, str | None, dict | None]:
    """Build chat context from ONE specific lesson (when session_id is given)
    or from the student's recent lessons (general mode).

    Returns (context_text, lesson_title).
    """
    if session_id:
        detail = lesson_generator.get_lesson(session_id, user_id=user_id)
        if detail:
            # Full lesson material — every section, key concepts, vocabulary —
            # so the tutor can answer anything the lesson actually covers.
            parts = [f"Lesson title: {detail.get('title', '')}"]
            if detail.get('summary'):
                parts.append(f"Summary: {detail['summary']}")
            for s in detail.get("sections", []):
                if s.get("text"):
                    parts.append(s["text"])
            if detail.get("key_concepts"):
                concepts = [c if isinstance(c, str) else c.get("text", "") for c in detail["key_concepts"]]
                parts.append("Key concepts: " + "; ".join(filter(None, concepts)))
            if detail.get("vocabulary"):
                parts.append("Vocabulary: " + "; ".join(
                    f"{v.get('term')}: {v.get('definition')}" for v in detail["vocabulary"] if v.get("term")))
            return "\n".join(parts), detail.get("title"), detail
        return "", None, None

    # No specific lesson — ground in the student's recent lessons (general mode).
    try:
        lessons = lesson_generator.list_user_lessons(user_id=user_id)
        if lessons:
            context_parts = []
            for lesson in lessons[:5]:
                detail = lesson_generator.get_lesson(lesson.get("session_id", ""), user_id=user_id)
                if detail:
                    sections_text = " ".join([s.get("text", "") for s in detail.get("sections", [])[:5]])
                    context_parts.append(f"Lesson: {detail.get('title', '')}\n{sections_text[:1000]}")
            return "\n\n".join(context_parts), None, None
    except Exception:
        pass
    return "", None, None


@router.post("/tutor", response_model=ChatResponse)
@limiter.limit("60/minute")
def tutor_chat(request: Request, req: ChatRequest):
    return TutorService.generate(req)


@router.post("/tutor/rag", response_model=ChatResponse)
@limiter.limit("60/minute")
def tutor_chat_with_context(request: Request, req: ChatRequest):
    user_id = req.username or "default"
    # Tutor chat is deliberately lesson-only.  A missing/foreign lesson must
    # never silently become a general-knowledge conversation.
    if not req.session_id:
        raise HTTPException(status_code=400, detail="Open a lesson before starting Tutor Chat.")
    context_text, resolved_title, lesson = _lesson_context(req.session_id, user_id)
    if not lesson or not context_text:
        raise HTTPException(status_code=404, detail="The current lesson is unavailable.")
    if req.source_id and req.source_id != lesson.get("source_id"):
        raise HTTPException(status_code=409, detail="The lesson source does not match the active source.")
    if req.course_id and req.course_id != lesson.get("course_id"):
        raise HTTPException(status_code=409, detail="The lesson course does not match the active course.")

    # A specific lesson was opened → STRICT grounding: the tutor answers only
    # from that lesson's material, never from general knowledge.
    strict = True
    if strict and not req.lesson_title and resolved_title:
        req.lesson_title = resolved_title

    weak_topics = []
    return TutorService.generate_with_context(
        req, context_text=context_text, weak_topics=weak_topics,
        grounding_mode="strict" if strict else "general")
