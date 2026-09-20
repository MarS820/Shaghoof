from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Optional
from ..services import web_lesson, content_formatter, lesson_generator, event_store, wordwall
from ..core.security import limiter


router = APIRouter(prefix="/lessons", tags=["Web Lessons"])


class WebLessonRequest(BaseModel):
    url: str = Field(..., min_length=5, max_length=2048)
    user_id: str = Field(default="default")
    topic: str | None = Field(default=None, max_length=255)
    subject: str = Field(default="", max_length=255)
    source_id: str | None = Field(default=None, max_length=255)
    course_id: str | None = Field(default=None, max_length=255)


class WebLessonResponse(BaseModel):
    session_id: str
    title: str
    summary: str
    sections: list[dict]
    key_concepts: list[dict]
    presentation: dict
    vark_mode: str
    sen_profile: str
    word_count: int
    status: str = "ok"


class FormatLessonRequest(BaseModel):
    session_id: str
    user_id: str = Field(default="default")
    vark: dict | None = Field(default=None)
    sen_profile: str = Field(default="general")
    sen_flags: list[str] = Field(default_factory=list)


class FormatLessonResponse(BaseModel):
    session_id: str
    formatted: dict
    status: str = "ok"


class GenerateFromTextRequest(BaseModel):
    text: str = Field(..., min_length=10)
    title: str = Field(default="Untitled Lesson", max_length=255)
    topic: str = Field(default="", max_length=255)
    subject: str = Field(default="", max_length=255)
    user_id: str = Field(default="default")
    source_id: str | None = Field(default=None, max_length=255)
    course_id: str | None = Field(default=None, max_length=255)


class GenerateFromMoodleRequest(BaseModel):
    course_name: str = Field(..., min_length=1)
    files: list[dict] = Field(default_factory=list)
    subject: str = Field(default="", max_length=255)
    user_id: str = Field(default="default")
    source_id: str | None = Field(default=None, max_length=255)
    course_id: str | None = Field(default=None, max_length=255)


class GenerateFromPdfSessionRequest(BaseModel):
    pdf_session_id: str = Field(..., min_length=1)
    filename: str = Field(default="", max_length=255)
    subject: str = Field(default="", max_length=255)
    user_id: str = Field(default="default")
    source_id: str | None = Field(default=None, max_length=255)
    course_id: str | None = Field(default=None, max_length=255)


class LessonListItem(BaseModel):
    session_id: str
    title: str
    summary: str
    source_type: str
    subject: str = ""
    word_count: int = 0
    created_at: str = ""


class LessonListResponse(BaseModel):
    lessons: list[LessonListItem]
    total: int


@router.post("/web", response_model=WebLessonResponse)
@limiter.limit("10/minute")
def create_web_lesson(request: Request, req: WebLessonRequest):
    try:
        raw = web_lesson.fetch_url_content(req.url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch URL: {e}")

    lesson = web_lesson.structure_lesson(raw['text'], title=raw.get('title', ''), topic=req.topic or '')
    lesson['source_url'] = req.url
    lesson['word_count'] = raw.get('word_count', 0)

    session_id = web_lesson.save_lesson(req.user_id, lesson)

    return WebLessonResponse(
        session_id=session_id,
        title=lesson['title'],
        summary=lesson['summary'],
        sections=lesson['sections'],
        key_concepts=[{'text': c} for c in lesson['key_concepts']],
        presentation=content_formatter._presentation_hints('visual', 'general', []),
        vark_mode='visual',
        sen_profile='general',
        word_count=raw.get('word_count', 0),
        status=raw.get('status', 'ok'),
    )


@router.post("/format", response_model=FormatLessonResponse)
@limiter.limit("30/minute")
def format_lesson(request: Request, req: FormatLessonRequest):
    lesson = web_lesson.load_lesson(req.session_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found. Upload or create a lesson first.")

    formatted = content_formatter.format_for_lesson(
        lesson,
        vark=req.vark,
        sen_profile=req.sen_profile,
        sen_flags=req.sen_flags,
    )

    return FormatLessonResponse(
        session_id=req.session_id,
        formatted=formatted,
    )


@router.post("/generate/url")
@limiter.limit("10/minute")
def generate_lesson_from_url(request: Request, req: WebLessonRequest):
    try:
        lesson = lesson_generator.generate_from_url(
            url=req.url, topic=req.topic or '', subject=req.subject, user_id=req.user_id,
            source_id=req.source_id, course_id=req.course_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to generate lesson: {e}")
    try:
        event_store.add_event(user_id=req.user_id, event_type='lesson_generated', topic=lesson.get('title', ''), payload={'session_id': lesson.get('session_id', '')})
    except Exception:
        pass
    return lesson


@router.post("/generate/pdf")
@limiter.limit("10/minute")
async def generate_lesson_from_pdf(
    request: Request,
    file: UploadFile = File(...),
    subject: str = Form(default=""),
    user_id: str = Form(default="default"),
    source_id: str | None = Form(default=None),
    course_id: str | None = Form(default=None),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds 50MB limit.")
    try:
        lesson = lesson_generator.generate_from_pdf(
            pdf_bytes=content, filename=file.filename, subject=subject, user_id=user_id,
            source_id=source_id, course_id=course_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate lesson: {e}")
    if 'error' in lesson:
        raise HTTPException(status_code=400, detail=lesson['error'])
    try:
        event_store.add_event(user_id=user_id, event_type='lesson_generated', topic=lesson.get('title', file.filename or 'PDF Lesson'), payload={'session_id': lesson.get('session_id', ''), 'subject': subject})
    except Exception:
        pass
    return lesson


@router.post("/generate/text")
@limiter.limit("15/minute")
def generate_lesson_from_text(request: Request, req: GenerateFromTextRequest):
    try:
        lesson = lesson_generator.generate_from_text(
            raw_text=req.text, title=req.title, topic=req.topic, subject=req.subject, user_id=req.user_id,
            source_id=req.source_id, course_id=req.course_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate lesson: {e}")
    try:
        event_store.add_event(user_id=req.user_id, event_type='lesson_generated', topic=lesson.get('title', req.title), payload={'session_id': lesson.get('session_id', ''), 'subject': req.subject})
    except Exception:
        pass
    return lesson


@router.post("/generate/pdf-session")
@limiter.limit("10/minute")
def generate_lesson_from_pdf_session(request: Request, req: GenerateFromPdfSessionRequest):
    try:
        lesson = lesson_generator.generate_from_pdf_session(
            pdf_session_id=req.pdf_session_id, filename=req.filename, subject=req.subject, user_id=req.user_id,
            source_id=req.source_id, course_id=req.course_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate lesson: {e}")
    if 'error' in lesson:
        raise HTTPException(status_code=400, detail=lesson['error'])
    try:
        event_store.add_event(user_id=req.user_id, event_type='lesson_generated', topic=lesson.get('title', req.filename or 'PDF Lesson'), payload={'session_id': lesson.get('session_id', ''), 'subject': req.subject})
    except Exception:
        pass
    return lesson


@router.post("/generate/moodle")
@limiter.limit("5/minute")
def generate_lesson_from_moodle(request: Request, req: GenerateFromMoodleRequest):
    try:
        lesson = lesson_generator.generate_from_moodle_course(
            course_name=req.course_name, files=req.files, subject=req.subject, user_id=req.user_id,
            source_id=req.source_id, course_id=req.course_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate lesson: {e}")
    try:
        event_store.add_event(user_id=req.user_id, event_type='lesson_generated', topic=lesson.get('title', req.course_name), payload={'session_id': lesson.get('session_id', ''), 'subject': req.subject})
    except Exception:
        pass
    return lesson


@router.get("/list", response_model=LessonListResponse)
def list_lessons(user_id: str = "default"):
    lessons = lesson_generator.list_user_lessons(user_id=user_id)
    return LessonListResponse(lessons=[LessonListItem(**l) for l in lessons], total=len(lessons))


@router.get("/detail/{session_id}")
def get_lesson_detail(session_id: str, user_id: str = "default"):
    lesson = lesson_generator.get_lesson(session_id, user_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found.")
    return lesson


@router.get("/wordwall/{session_id}")
def get_wordwall_pack(session_id: str, user_id: str = "default", template_id: Optional[str] = None):
    """Wordwall-style game pack for a lesson — game kind follows the student's
    active template and every item is drawn ONLY from the lesson's own content."""
    lesson = lesson_generator.get_lesson(session_id, user_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found.")
    pack = wordwall.build_pack(lesson, template_id)
    if not pack:
        raise HTTPException(status_code=422, detail="This lesson is too short for a game — try a richer source.")
    return pack
