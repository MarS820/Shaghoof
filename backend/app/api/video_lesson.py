from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from ..services import video_lesson, web_lesson, content_formatter
from ..core.security import limiter


router = APIRouter(prefix="/video", tags=["Video Lessons"])


class VideoLessonRequest(BaseModel):
    session_id: str | None = Field(default=None, description="Existing lesson session_id from /lessons/web")
    lesson_data: dict | None = Field(default=None, description="Raw lesson data if no session_id")
    user_id: str = Field(default="default")
    duration_minutes: int = Field(default=5, ge=2, le=15)
    vark_mode: str = Field(default="visual")
    sen_profile: str = Field(default="general")
    sen_flags: list[str] = Field(default_factory=list)
    template_id: str | None = Field(default=None, description="Override template T1-T6; otherwise resolved from the student profile")
    ai_clips: bool = Field(default=False, description="Generate short AI motion clips per scene (requires REPLICATE_API_TOKEN)")


class VideoLessonResponse(BaseModel):
    title: str
    total_duration_seconds: int
    total_duration_label: str
    scene_count: int
    vark_mode: str
    sen_profile: str
    template_id: str = "T3"
    scenes: list[dict]
    status: str = "generated"


@router.post("/generate", response_model=VideoLessonResponse)
@limiter.limit("10/minute")
def generate_video(request: Request, req: VideoLessonRequest):
    lesson = None

    if req.session_id:
        lesson = web_lesson.load_lesson(req.session_id)
        if not lesson:
            raise HTTPException(status_code=404, detail="Lesson not found. Create a lesson first via /lessons/web.")
    elif req.lesson_data:
        lesson = req.lesson_data
    else:
        raise HTTPException(status_code=400, detail="Provide session_id or lesson_data.")

    # Resolve the student's active template when the request doesn't pin one.
    vark_mode = req.vark_mode
    sen_profile = req.sen_profile
    template_id = req.template_id
    try:
        from ..services.lesson_generator import _resolve_user_template
        resolved_mode, resolved_profile, resolved_template = _resolve_user_template(req.user_id)
        if template_id not in ('T1', 'T2', 'T3', 'T4', 'T5', 'T6'):
            template_id = resolved_template
        if sen_profile == 'general':
            sen_profile = resolved_profile
        if req.vark_mode == 'visual':
            vark_mode = resolved_mode
    except Exception:
        template_id = template_id or 'T3'

    video = video_lesson.generate_video_script(
        lesson,
        duration_minutes=req.duration_minutes,
        vark_mode=vark_mode,
        sen_profile=sen_profile,
        template_id=template_id,
        ai_clips=req.ai_clips,
    )

    video_lesson.save_video_lesson(req.user_id, video)

    return VideoLessonResponse(**video)
