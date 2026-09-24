"""C3: Digital Twin Profile endpoints."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
import base64
import hashlib
import hmac
import os

from ..core import store
from ..services import twin as twin_srv, retention, planner

router = APIRouter(prefix="/api/v1", tags=["profile"])


class SubjectRecord(BaseModel):
    id: str = ""
    name: str = ""
    sources: List[dict] = Field(default_factory=list)


class DataSourceRecord(BaseModel):
    id: str = ""
    type: str = ""
    name: str = ""
    subject: str = ""
    url: str = ""
    sessionId: str = ""
    wordCount: int = 0


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    email: Optional[str] = None
    sen_flags: List[str] = Field(default_factory=list)
    sen_profile: Optional[str] = None
    vark: Optional[Dict[str, float]] = None
    preferred_core: Optional[str] = None
    dyslexic: Optional[bool] = None
    custom_topics: List[str] = Field(default_factory=list)
    subjects: Optional[List[SubjectRecord]] = None
    dataSources: Optional[List[DataSourceRecord]] = None


class RegisterIn(BaseModel):
    user_id: str
    name: str
    email: Optional[str] = None
    age: Optional[int] = None
    # School users pick a GRADE instead of an age — the grade auto-links them
    # to every classroom a teacher created for the same grade.
    grade: Optional[str] = None
    school_user: bool = False
    sen_flags: List[str] = Field(default_factory=list)
    sen_scores: Dict[str, float] = Field(default_factory=dict)
    sen_profile: Optional[str] = None
    vark: Optional[Dict[str, float]] = None
    custom_topic: Optional[str] = None
    role: str = "student"  # "student" or "teacher"
    password: Optional[str] = None
    onboarding_complete: Optional[bool] = None


class LoginIn(BaseModel):
    email: str
    password: str


class QuizInteraction(BaseModel):
    selected: str
    first_click: Optional[str] = None
    hover_ms: Dict[str, int] = Field(default_factory=dict)
    path: List[str] = Field(default_factory=list)


class VarkQuizIn(BaseModel):
    user_id: str
    interactions: List[QuizInteraction] = Field(default_factory=list)
    vark: Optional[Dict[str, float]] = None
    vark_answers: List[str] = Field(default_factory=list)
    sen_flags: List[str] = Field(default_factory=list)
    sen_scores: Dict[str, float] = Field(default_factory=dict)
    sen_profile: Optional[str] = None
    sen_answers: Dict[str, int] = Field(default_factory=dict)


class DailyPlanComplete(BaseModel):
    user_id: str
    task_id: str


VARK_STYLES = {"visual", "auditory", "reading", "kinesthetic"}


def _hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 210_000)
    return base64.b64encode(salt).decode() + "$" + base64.b64encode(digest).decode()


def _password_matches(password: str, encoded: str) -> bool:
    try:
        salt_b64, digest_b64 = encoded.split("$", 1)
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), base64.b64decode(salt_b64), 210_000
        )
        return hmac.compare_digest(digest, base64.b64decode(digest_b64))
    except (ValueError, TypeError):
        return False


@router.post("/register")
def register(data: RegisterIn):
    """Create / ensure a digital twin for a new user."""
    if data.role not in {"student", "teacher"}:
        raise HTTPException(status_code=422, detail="role must be student or teacher")
    if data.password is not None and len(data.password) < 6:
        raise HTTPException(status_code=422, detail="Password must contain at least 6 characters")
    existing = store.find_by_email(data.email) if data.email else None
    if existing and existing.get("user_id") != data.user_id and existing.get("password_hash"):
        raise HTTPException(status_code=409, detail="An account already exists for this email")
    flags_lower = [str(f).lower() for f in data.sen_flags]
    # School users enroll by GRADE (auto-links to teacher classrooms of the same
    # grade); home users keep the age → grade mapping.
    if data.school_user and data.grade:
        grade = str(data.grade).strip().lower()
        grade = {"1": "1st", "2": "2nd", "3": "3rd"}.get(grade, grade)
    else:
        grade = store.age_to_grade(data.age or 10)
    twin_rec = store.ensure(
        data.user_id,
        defaults={
            "user_id": data.user_id,
            "role": data.role,
            "name": data.name,
            "email": data.email,
            "age": data.age if data.age is not None else (store.GRADE_TO_AGE.get(grade, 10) if data.school_user else 10),
            "grade": grade,
            "sen_flags": data.sen_flags,
            "sen_scores": data.sen_scores,
            "sen_profile": data.sen_profile or "general",
            "vark": data.vark or dict(store.DEFAULT_VARK),
            "xp": 0,
            "badge": "Bronze",
            "reviews": {},
            "assessment_history": [],
            "custom_topics": [data.custom_topic] if data.custom_topic else [],
            "interests": [data.custom_topic] if data.custom_topic else [],
            "dyslexic": any(flag in flags_lower for flag in ("cognitive", "dyslexia", "dyslexic")),
            "emotion": None,
            "affirmations": [],
            "onboarding_complete": data.role == "teacher" or bool(data.onboarding_complete),
            "vark_quiz": [],
            "enrolled_classes": [],
        },
    )
    patch = {
        "role": data.role,
        "name": data.name,
        "email": data.email,
        "grade": grade,
        "school_user": bool(data.school_user),
        "sen_flags": data.sen_flags,
        "sen_scores": data.sen_scores,
        "sen_profile": data.sen_profile or twin_rec.get("sen_profile", "general"),
        "dyslexic": any(flag in flags_lower for flag in ("cognitive", "dyslexia", "dyslexic")),
    }
    if data.vark:
        patch["vark"] = data.vark
    if data.age is not None:
        patch["age"] = data.age
    if data.onboarding_complete is not None:
        patch["onboarding_complete"] = data.onboarding_complete
    elif data.role == "teacher" or data.vark:
        patch["onboarding_complete"] = True
    if data.custom_topic:
        patch["custom_topics"] = sorted(set(twin_rec.get("custom_topics", []) + [data.custom_topic]))
        patch["interests"] = sorted(set(twin_rec.get("interests", []) + [data.custom_topic]))
    if data.password:
        patch["password_hash"] = _hash_password(data.password)
    twin_rec = store.update(data.user_id, patch)
    _auto_enroll_student(data.user_id, grade)
    return {
        "ok": True,
        "profile": {
            "user_id": twin_rec["user_id"],
            "role": twin_rec.get("role", "student"),
            "name": twin_rec["name"],
            "age": twin_rec["age"],
            "grade": twin_rec.get("grade", "5th"),
            "sen_flags": twin_rec["sen_flags"],
            "sen_scores": twin_rec.get("sen_scores", {}),
            "sen_profile": twin_rec.get("sen_profile", "general"),
            "xp": twin_rec["xp"],
            "badge": twin_rec["badge"],
            "vark": twin_rec["vark"],
            "onboarding_complete": twin_rec.get("onboarding_complete", False),
        },
    }


@router.get("/auth/email-available")
def email_available(email: str, exclude_user_id: Optional[str] = None):
    """Lightweight pre-flight check so the signup form can fail fast.

    Returns whether the email is free *and* whether it belongs to an existing
    account with a password (a passwordless twin does not block signup).
    """
    existing = store.find_by_email(email) if email else None
    taken = bool(existing and existing.get("password_hash"))
    if existing and exclude_user_id and existing.get("user_id") == exclude_user_id:
        taken = False
    return {"available": not taken}


@router.post("/auth/login")
def login(data: LoginIn):
    """Authenticate against the persisted demo account store.

    Passwords are PBKDF2 hashes; the browser retains only the non-sensitive
    profile data needed to restore a local session.
    """
    twin_rec = store.find_by_email(data.email)
    if not twin_rec or not twin_rec.get("password_hash") or not _password_matches(data.password, twin_rec["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if twin_rec.get("role") == "student":
        grade = twin_rec.get("grade") or store.age_to_grade(twin_rec.get("age", 10))
        if grade != twin_rec.get("grade"):
            store.update(twin_rec["user_id"], {"grade": grade})
        _auto_enroll_student(twin_rec["user_id"], grade)
        twin_rec = store.load(twin_rec["user_id"])
    return {"ok": True, "profile": _public_profile(twin_rec)}


@router.post("/quiz/submit")
def submit_vark_quiz(data: VarkQuizIn):
    """Store VARK + SEN screening from registration or the onboarding quiz."""
    twin_rec = store.ensure(data.user_id)

    if data.vark:
        vark = {style: float(data.vark.get(style, 0)) for style in VARK_STYLES}
        total = sum(vark.values()) or 1
        vark = {style: round((score / total) * 100, 1) for style, score in vark.items()}
        twin_rec["vark"] = vark
        twin_rec["vark_quiz"] = data.vark_answers
    elif data.vark_answers:
        points = {style: 0.0 for style in VARK_STYLES}
        for style in data.vark_answers:
            if style not in VARK_STYLES:
                raise HTTPException(status_code=422, detail="Invalid learning style")
            points[style] += 10
        total = sum(points.values()) or 1
        twin_rec["vark"] = {style: round((points[style] / total) * 100, 1) for style in VARK_STYLES}
        twin_rec["vark_quiz"] = data.vark_answers
    else:
        if len(data.interactions) != 5:
            raise HTTPException(status_code=422, detail="The VARK quiz needs screening answers or exactly 5 interactions")
        points = {style: 0.0 for style in VARK_STYLES}
        clean_interactions = []
        for item in data.interactions:
            if item.selected not in VARK_STYLES:
                raise HTTPException(status_code=422, detail="Invalid learning style")
            points[item.selected] += 10
            if item.first_click in VARK_STYLES:
                points[item.first_click] += 2
            for style, milliseconds in item.hover_ms.items():
                if style in VARK_STYLES and milliseconds >= 900:
                    points[style] += min(3, milliseconds / 3000)
            clean_interactions.append(item.model_dump())
        total = sum(points.values()) or 1
        twin_rec["vark"] = {style: round((points[style] / total) * 100, 1) for style in VARK_STYLES}
        twin_rec["vark_quiz"] = clean_interactions

    if data.sen_flags:
        twin_rec["sen_flags"] = data.sen_flags
        flags_lower = [str(f).lower() for f in data.sen_flags]
        twin_rec["dyslexic"] = any(flag in flags_lower for flag in ("cognitive", "dyslexia", "dyslexic"))
    if data.sen_scores:
        twin_rec["sen_scores"] = data.sen_scores
    if data.sen_profile:
        twin_rec["sen_profile"] = data.sen_profile
    if data.sen_answers:
        twin_rec["sen_quiz"] = data.sen_answers

    twin_rec["onboarding_complete"] = True
    store.save(data.user_id, twin_rec)
    return {"ok": True, "brainwheel": twin_srv.brainwheel(twin_rec), "profile": _public_profile(twin_rec)}


def _public_profile(twin_rec):
    return {
        "id": twin_rec.get("user_id"),
        "user_id": twin_rec.get("user_id"),
        "role": twin_rec.get("role", "student"),
        "name": twin_rec.get("name"),
        "email": twin_rec.get("email"),
        "age": twin_rec.get("age"),
        "grade": twin_rec.get("grade", "5th"),
        "conditions": twin_rec.get("sen_flags", []),
        "sen_flags": twin_rec.get("sen_flags", []),
        "sen_scores": twin_rec.get("sen_scores", {}),
        "sen_profile": twin_rec.get("sen_profile", "general"),
        "preferred_core": twin_rec.get("preferred_core"),
        "xp": twin_rec.get("xp", 0),
        "badge": twin_rec.get("badge", "Bronze"),
        "vark": twin_rec.get("vark", {}),
        "onboarding_complete": twin_rec.get("onboarding_complete", False),
        "enrolled_classes": twin_rec.get("enrolled_classes", []),
    }


def _auto_enroll_student(user_id, grade):
    """Automatically enroll a student into all classes matching their grade."""
    from ..models import Classroom, StudentEnrollment
    from ..core.database import SessionLocal
    from sqlalchemy import select

    db = SessionLocal()
    try:
        stmt = select(Classroom).where(Classroom.grade == grade)
        classes = db.execute(stmt).scalars().all()
        twin_rec = store.load(user_id)
        name = twin_rec.get("name", "Student") if twin_rec else "Student"
        email = twin_rec.get("email", "") if twin_rec else ""

        for cls in classes:
            stmt2 = select(StudentEnrollment).where(
                StudentEnrollment.class_id == cls.id,
                StudentEnrollment.student_id == user_id,
                StudentEnrollment.enrollment_status == "active",
            )
            existing = db.execute(stmt2).scalar_one_or_none()
            if not existing:
                enrollment = StudentEnrollment(
                    class_id=cls.id,
                    student_id=user_id,
                    student_name=name,
                    student_email=email,
                    progress=0,
                    status="green",
                )
                db.add(enrollment)

        db.commit()

        enrolled = set()
        for cls in classes:
            stmt3 = select(StudentEnrollment).where(
                StudentEnrollment.class_id == cls.id,
                StudentEnrollment.student_id == user_id,
                StudentEnrollment.enrollment_status == "active",
            )
            if db.execute(stmt3).scalar_one_or_none():
                enrolled.add(cls.id)

        old_enrolled = set(twin_rec.get("enrolled_classes", []) if twin_rec else [])
        if enrolled - old_enrolled:
            store.update(user_id, {"enrolled_classes": sorted(enrolled)})
    except Exception:
        import logging
        logging.getLogger(__name__).exception("Auto-enroll failed for %s (grade %s)", user_id, grade)
        db.rollback()
    finally:
        db.close()


def _sync_enrolled_classes(user_id: str, grade: Optional[str] = None) -> list:
    """Re-sync twin enrolled_classes from SQL (and back-fill missing rows).

    Students restored from localStorage never hit /auth/login, so a class
    created after they signed in would otherwise stay invisible until the
    next full login. Cheap enough to run on profile/enrolled reads.
    """
    twin_rec = store.ensure(user_id)
    if grade is None:
        grade = twin_rec.get("grade") or store.age_to_grade(twin_rec.get("age", 10))
    _auto_enroll_student(user_id, grade)
    twin_rec = store.load(user_id) or twin_rec
    return list(twin_rec.get("enrolled_classes") or [])


@router.get("/profile/brainwheel")
def brainwheel(user_id: str):
    twin_rec = store.ensure(user_id)
    return twin_srv.brainwheel(twin_rec)


@router.get("/profile")
def get_profile(user_id: str):
    # Teacher accounts live in SQL, not the student twin store. Do not
    # create/serve a student twin for teacher-* ids (it forces role=student
    # and wipes name/email after refreshProfile).
    if str(user_id).startswith("teacher-"):
        from ..core.database import SessionLocal
        from ..models import TeacherUser
        from ..services.common import public_user
        db = SessionLocal()
        try:
            teacher = db.get(TeacherUser, user_id)
            if teacher:
                pub = public_user(teacher)
                return {
                    "user_id": pub["id"],
                    "id": pub["id"],
                    "role": "teacher",
                    "name": pub["name"],
                    "email": pub["email"],
                    "grade": None,
                    "subjects": [],
                    "data_sources": [],
                    "enrolled_classes": [],
                    "onboarding_complete": True,
                }
        finally:
            db.close()

    twin_rec = store.ensure(user_id)
    grade = twin_rec.get("grade") or store.age_to_grade(twin_rec.get("age", 10))
    enrolled_classes = _sync_enrolled_classes(user_id, grade)
    return {
        "user_id": user_id,
        "role": twin_rec.get("role", "student"),
        "name": twin_rec.get("name"),
        "email": twin_rec.get("email"),
        "age": twin_rec.get("age"),
        "grade": grade,
        "school_user": twin_rec.get("school_user", False),
        "sen_flags": twin_rec.get("sen_flags"),
        "sen_scores": twin_rec.get("sen_scores", {}),
        "sen_profile": twin_rec.get("sen_profile", "general"),
        "preferred_core": twin_rec.get("preferred_core"),
        "dyslexic": twin_rec.get("dyslexic", False),
        "xp": twin_rec.get("xp", 0),
        "badge": twin_rec.get("badge"),
        "vark": twin_rec.get("vark"),
        "misconception_bins": twin_rec.get("misconception_bins"),
        "assessment_count": len(twin_rec.get("assessment_history", [])),
        "exam_history": twin_rec.get("exam_history", [])[-10:],
        "pending_reviews": twin_rec.get("pending_reviews"),
        "custom_topics": twin_rec.get("custom_topics"),
        "subjects": twin_rec.get("subjects", []),
        "data_sources": twin_rec.get("data_sources", []),
        "interests": twin_rec.get("interests", []),
        "topics": twin_rec.get("topics", {}),
        "onboarding_complete": twin_rec.get("onboarding_complete", False),
        "endowed_progress": retention.endowed_progress(twin_rec.get("vark")),
        "enrolled_classes": enrolled_classes,
    }


@router.get("/student/enrolled-classes")
def get_enrolled_classes(user_id: str):
    """Return the classes a student is enrolled in with details."""
    from ..models import Classroom, StudentEnrollment
    from ..core.database import SessionLocal

    twin_rec = store.ensure(user_id)
    grade = twin_rec.get("grade") or store.age_to_grade(twin_rec.get("age", 10))
    enrolled_ids = _sync_enrolled_classes(user_id, grade)
    if not enrolled_ids:
        return []
    db = SessionLocal()
    try:
        result = []
        for cid in enrolled_ids:
            cls = db.get(Classroom, cid)
            if cls:
                count = db.query(StudentEnrollment).filter(
                    StudentEnrollment.class_id == cid,
                    StudentEnrollment.enrollment_status == "active",
                ).count()
                result.append({
                    "id": cls.id,
                    "name": cls.name,
                    "grade": cls.grade,
                    "student_count": count,
                })
        return result
    finally:
        db.close()


def _daily_plan_for(twin_rec):
    plan = planner.build_daily_plan(twin_rec)
    saved = twin_rec.get("daily_plan", {})
    if saved.get("date") == plan["date"]:
        completed_ids = {task.get("id") for task in saved.get("tasks", []) if task.get("completed")}
        for task in plan["tasks"]:
            task["completed"] = task["id"] in completed_ids
    return plan


@router.get("/plan/daily")
def daily_plan(user_id: str, language: str = "en"):
    """Return today's adaptive plan from age, interests, VARK, mood and results."""
    twin_rec = store.ensure(user_id)
    plan = _daily_plan_for(twin_rec)
    twin_rec["daily_plan"] = plan
    store.save(user_id, twin_rec)
    plan["language"] = "ar" if language == "ar" else "en"
    return plan


@router.post("/plan/daily/complete")
def complete_daily_plan_task(data: DailyPlanComplete):
    twin_rec = store.ensure(data.user_id)
    plan = _daily_plan_for(twin_rec)
    task = next((item for item in plan["tasks"] if item["id"] == data.task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail="Plan task was not found")
    task["completed"] = True
    twin_rec["daily_plan"] = plan
    store.save(data.user_id, twin_rec)
    return plan


@router.put("/profile")
def update_profile(user_id: str, data: ProfileUpdate):
    twin_rec = store.ensure(user_id)
    patch = {}
    if data.name is not None:
        patch["name"] = data.name
    if data.age is not None:
        patch["age"] = data.age
    if data.email is not None:
        patch["email"] = data.email
    if data.sen_flags:
        patch["sen_flags"] = data.sen_flags
        patch["dyslexic"] = any(
            str(flag).lower() in {"cognitive", "dyslexia", "dyslexic"} for flag in data.sen_flags
        )
    if data.sen_profile:
        patch["sen_profile"] = data.sen_profile
    if data.vark:
        patch["vark"] = data.vark
    if data.preferred_core:
        patch["preferred_core"] = data.preferred_core
    if data.custom_topics:
        existing = set(twin_rec.get("custom_topics", []))
        existing.update(data.custom_topics)
        patch["custom_topics"] = sorted(existing)
    # Student-defined subjects and data sources (single source of truth for
    # lessons/quizzes/tutor grounding). Replace wholesale on each save.
    if data.subjects is not None:
        patch["subjects"] = [s.model_dump() for s in data.subjects]
        patch["custom_topics"] = sorted(
            set(twin_rec.get("custom_topics", [])) | {s.name for s in data.subjects if s.name}
        )
    if data.dataSources is not None:
        patch["data_sources"] = [s.model_dump(exclude_none=True) for s in data.dataSources]
    if patch:
        store.update(user_id, patch)
    twin_rec = store.ensure(user_id)
    return {"ok": True, "profile": twin_rec}
