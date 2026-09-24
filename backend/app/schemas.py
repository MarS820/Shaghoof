from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class TeacherRegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=6, max_length=128)


class TeacherLoginIn(BaseModel):
    email: str
    password: str


class ClassCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    grade: str = Field(min_length=1, max_length=80)


class StudentCreateIn(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    email: str = Field(min_length=5, max_length=255)
    password: str | None = Field(default=None, min_length=6, max_length=128)
    progress: float = Field(default=0, ge=0, le=100)
    status: str = Field(default="green", pattern="^(green|yellow|red)$")
    xp: int = Field(default=0, ge=0)
    badge: str = Field(default="Bronze", max_length=30)


class EnrollmentUpdateIn(BaseModel):
    progress: float | None = Field(default=None, ge=0, le=100)
    status: str | None = Field(default=None, pattern="^(green|yellow|red)$")
    xp: int | None = Field(default=None, ge=0)
    badge: str | None = Field(default=None, max_length=30)


class AssessmentCreateIn(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    max_score: float = Field(default=100, gt=0)
    weight: float = Field(default=1.0, gt=0)
    attempt_limit: int = Field(default=1, ge=1, le=20)
    due_at: datetime | None = None
    status: str = Field(default="draft", pattern="^(draft|published|closed)$")


class AssessmentUpdateIn(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=255)
    max_score: float | None = Field(default=None, gt=0)
    weight: float | None = Field(default=None, gt=0)
    attempt_limit: int | None = Field(default=None, ge=1, le=20)
    due_at: datetime | None = None
    status: str | None = Field(default=None, pattern="^(draft|published|closed)$")


class SubmissionCreateIn(BaseModel):
    assessment_id: int
    student_id: str
    raw_score: float = Field(ge=0)
    ai_score: float | None = Field(default=None, ge=0, le=100)
    attempt_no: int | None = Field(default=None, ge=1)
    misconception: str | None = Field(default=None, max_length=255)
    teacher_feedback: str | None = Field(default=None, max_length=3000)
    submitted_at: datetime | None = None


class GradeOverrideIn(BaseModel):
    submission_id: int
    new_percentage: float = Field(ge=0, le=100)
    reason: str = Field(min_length=3, max_length=500)


class TeacherNoteIn(BaseModel):
    note: str = Field(min_length=2, max_length=2000)
    category: str = Field(default="general", min_length=2, max_length=30)
    pinned: bool = False
    follow_up_at: datetime | None = None


class InterventionCreateIn(BaseModel):
    class_id: int
    student_id: str
    title: str = Field(min_length=3, max_length=255)
    action_type: str = Field(default="follow_up", min_length=2, max_length=50)
    priority: str = Field(default="medium", pattern="^(low|medium|high|critical)$")
    details: str | None = Field(default=None, max_length=2000)
    due_at: datetime | None = None
    scheduled_at: datetime | None = None


class InterventionUpdateIn(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=255)
    action_type: str | None = Field(default=None, min_length=2, max_length=50)
    priority: str | None = Field(default=None, pattern="^(low|medium|high|critical)$")
    status: str | None = Field(default=None, pattern="^(suggested|approved|scheduled|in_progress|completed|outcome_review|dismissed)$")
    details: str | None = Field(default=None, max_length=2000)
    due_at: datetime | None = None
    scheduled_at: datetime | None = None
    outcome_score: float | None = Field(default=None, ge=0, le=100)
    outcome_notes: str | None = Field(default=None, max_length=2000)


class TeacherSettingsIn(BaseModel):
    notifications: bool
    risk_threshold: int = Field(default=40, ge=10, le=90)


# ── Tutor Chat ──────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    modality: str = Field(default="visual", description="VARK modality: visual, auditory, reading, kinesthetic")
    feynman_level: str = Field(default="academic", description="intuitive, academic, deep")
    username: str = Field(default="student")
    egyptian_dialect: bool = Field(default=True)
    language: str = Field(default="ar", description="ar or en")
    # Strict lesson grounding: when session_id is set the tutor answers ONLY
    # from that lesson's material — never general knowledge.
    session_id: Optional[str] = None
    lesson_title: Optional[str] = None
    strict_lesson: bool = False
    # Immutable provenance supplied by the lesson player.  These are validated
    # against the stored lesson rather than trusted as client-provided context.
    source_id: Optional[str] = Field(default=None, max_length=255)
    course_id: Optional[str] = Field(default=None, max_length=255)


class ChatResponse(BaseModel):
    sender: str = "bot"
    text: str
    feynman_level: str
    modality: str
    language: str
    status: str = "success"


# ── Quiz Generation ─────────────────────────────────────────────────────────

class QuizGenerateRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=255)
    n: int = Field(default=5, ge=1, le=20)
    difficulty: str = Field(default="Medium", pattern="^(Easy|Medium|Hard)$")
    subject: str | None = Field(default=None, max_length=255)
    avoid: list[str] | None = Field(default=None, description="Questions to avoid repeating")
    user_id: str | None = Field(default=None)
    ground_in_lessons: bool = Field(default=False, description="Ground every question in the student's own lesson material")
    vark_mode: str | None = Field(default=None, description="Override: visual, auditory, reading, kinesthetic")
    sen_profile: str | None = Field(default=None, description="Override: general, text, focus, structure")
    question_types: list[str] | None = Field(
        default=None,
        description="Allowed types: mcq, true_false, fill_blank, short_answer. Defaults by template.",
    )


class QuizQuestionOut(BaseModel):
    question: str
    type: str = Field(default="mcq", description="mcq | true_false | fill_blank | short_answer")
    options: list[str] = Field(default_factory=list)
    correct: int | None = Field(default=None, description="MCQ correct index (0-based)")
    correct_answer: str | None = Field(default=None, description="Canonical answer for non-MCQ types")
    accepted_answers: list[str] = Field(default_factory=list, description="Accepted fill/short answers")
    difficulty: str = "Medium"
    explanation: str = ""


class QuizAdaptationOut(BaseModel):
    vark_mode: str = "visual"
    sen_profile: str = "general"
    template_id: str = "T3"


class QuizGenerateResponse(BaseModel):
    questions: list[QuizQuestionOut]
    topic: str
    difficulty: str
    adaptation: QuizAdaptationOut = Field(default_factory=QuizAdaptationOut)


# ── Flashcard Generation ────────────────────────────────────────────────────

class FlashcardGenerateRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=255)
    n: int = Field(default=8, ge=1, le=30)
    weak_topics: list[str] | None = Field(default=None)
    user_id: str | None = Field(default=None)


class FlashcardOut(BaseModel):
    front: str
    back: str


class FlashcardGenerateResponse(BaseModel):
    cards: list[FlashcardOut]
    topic: str


# ── Assignment Generation ───────────────────────────────────────────────────

class AssignmentGenerateRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=255)
    source: str = Field(default="", max_length=50000, description="Source material text")
    student_level: str = Field(default="intermediate", max_length=100)
    assignment_type: str = Field(default="mixed", max_length=100)
    difficulty: str = Field(default="medium", max_length=50)
    count: int = Field(default=5, ge=1, le=20)
    user_id: str | None = Field(default=None)


class AssignmentGenerateResponse(BaseModel):
    assignment: str
    topic: str
    status: str = "success"


# ── Podcast Generation ──────────────────────────────────────────────────────

class PodcastRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=255)
    language: str = Field(default="ar")
    dialect: bool = Field(default=True)


class PodcastDialogueLine(BaseModel):
    speaker: str
    speakerName: str
    avatar: str
    role: str
    text: str
    timestamp: str


class PodcastHost(BaseModel):
    id: str
    name: str
    role: str
    avatar: str


class PodcastResponse(BaseModel):
    topic: str
    title: str
    duration: str
    hosts: list[PodcastHost]
    dialogue: list[PodcastDialogueLine]


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    speaker: str = Field(default="host1")
    language: str = Field(default="ar")
    dialect: bool = Field(default=True)
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    engine: str = Field(default="elevenlabs", pattern="^(elevenlabs|azure|google)$")
    api_key: Optional[str] = Field(default=None, description="Optional ElevenLabs xi-api-key")


# ── Feynman Evaluator ───────────────────────────────────────────────────────

class FeynmanEvaluateRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=255)
    student_explanation: str = Field(..., min_length=5, max_length=5000)
    language: str = Field(default="ar")


class FeynmanEvaluateResponse(BaseModel):
    topic: str
    word_count: int
    simplicity_score: int
    jargon_count: int
    detected_jargons: list[str]
    has_analogy: bool
    grandma_test_passed: bool
    verdict: str
    feedback: str
    xp_earned: int


# ── Knowledge Graph ─────────────────────────────────────────────────────────

class GraphNode(BaseModel):
    id: str
    label: str
    labelAr: str
    category: str
    level: int
    val: int


class GraphEdge(BaseModel):
    source: str
    target: str
    label: str


class GraphCluster(BaseModel):
    id: str
    name: str
    color: str


class KnowledgeGraphResponse(BaseModel):
    course_id: str
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    clusters: list[GraphCluster]


# ── RAG Benchmark ───────────────────────────────────────────────────────────

class RAGBenchmarkResponse(BaseModel):
    status: str
    evaluator_framework: str
    overall_score: float
    metrics: dict
    status_summary: str = "verified"


# ── Two-Pass Assessment ─────────────────────────────────────────────────────

class TwoPassSubmitRequest(BaseModel):
    question_id: int
    user_answer: str = Field(..., min_length=1, max_length=3000)
    username: str = Field(default="student")


class TwoPassSubmitResponse(BaseModel):
    pass1_score: int
    conceptual_status: str
    concept_feedback: str
    pass2_spelling_box: str
    misconception_bin: str


# ── PDF Chat / RAG ──────────────────────────────────────────────────────────

class PdfChatRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    session_id: str | None = Field(default=None)
    history: list[dict] | None = Field(default=None)
    language: str = Field(default="ar")
    user_id: str = Field(default="default")


class PdfChatResponse(BaseModel):
    answer: str
    sources: list[dict] = []
    status: str = "success"


class PdfUploadResponse(BaseModel):
    session_id: str
    filename: str
    page_count: int
    chunk_count: int
    status: str = "processed"


# ── Moodle Integration ──────────────────────────────────────────────────────

class MoodleConnectRequest(BaseModel):
    moodle_url: str = Field(..., description="Base URL of the Moodle instance")
    token: str = Field(..., description="Moodle Web Services REST Token")
    user_id: str | None = Field(default="default")


class MoodleCourseSchema(BaseModel):
    id: int | None = None
    moodle_course_id: int
    course_name: str
    course_code: str = ""
    summary: str = ""
    activation_status: str = "not_activated"
    sync_status: str = "idle"
    pdf_count: int = 0
    synced_pdf_count: int = 0
    total_pages: int = 0
    total_chunks: int = 0
    last_synced_at: str | None = None


class MoodleConnectionResponse(BaseModel):
    status: str
    moodle_url: str
    site_name: str
    moodle_user_id: int
    moodle_username: str
    moodle_fullname: str
    moodle_version: str = ""
    courses_count: int
    courses: list[MoodleCourseSchema] = []


class MoodleStatusResponse(BaseModel):
    is_connected: bool
    connection: dict | None = None
    enrolled_courses_count: int = 0
    activated_courses_count: int = 0


class MoodleFileSchema(BaseModel):
    id: int | None = None
    moodle_file_id: str
    filename: str
    section_name: str = "General"
    file_url: str
    file_size: int = 0
    page_count: int = 0
    chunk_count: int = 0
    processing_status: str = "pending"
    error_message: str | None = None
    created_at: str | None = None


class ActivateCourseResponse(BaseModel):
    job_id: str
    course_id: int
    status: str
    message: str


class SyncJobResponse(BaseModel):
    job_id: str
    course_id: int | None = None
    status: str
    total_files: int = 0
    downloaded_files: int = 0
    processed_files: int = 0
    failed_files: int = 0
    progress: int = 0
    current_file: str | None = None
    error_message: str | None = None
    details: list[dict] = []
    started_at: str | None = None
    completed_at: str | None = None


class MoodleRagQueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    course_id: int | None = None
    user_id: str = "default"
    language: str = "ar"


class MoodleRagCitation(BaseModel):
    course_name: str
    filename: str
    section_name: str = ""
    page_number: int
    source_chunk_preview: str | None = None


class MoodleRagQueryResponse(BaseModel):
    answer: str
    citations: list[MoodleRagCitation] = []
    course_filtered: str = "all"
    status: str = "success"


# ── Personalization / Learning Analytics ─────────────────────────────────────

class LearningInsightsResponse(BaseModel):
    weak_topics: list[str]
    strong_topics: list[str]
    recommendations: list[str]
    learning_pace: dict
    topic_engagement: dict
    metrics: dict
