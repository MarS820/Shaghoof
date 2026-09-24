from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
import uuid
from collections import defaultdict
from datetime import datetime
from statistics import mean

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..core.database import get_db, SessionLocal
from ..models import (
    Assessment, AuditLog, Classroom, InterventionTask, Notification,
    StudentEnrollment, Submission, TeacherClassAssignment, TeacherNote,
    TeacherSetting, TeacherUser,
)
from ..schemas import (
    AssessmentCreateIn, AssessmentUpdateIn, ClassCreateIn, EnrollmentUpdateIn,
    GradeOverrideIn, InterventionCreateIn, InterventionUpdateIn, StudentCreateIn,
    SubmissionCreateIn, TeacherLoginIn, TeacherNoteIn, TeacherRegisterIn,
    TeacherSettingsIn,
)
from ..services.analytics import (
    assessment_analytics, dashboard_snapshot, intervention_suggestions,
    student_academic_risk, student_analytics,
)
from ..services.common import audit, is_enrolled, public_user, require_enrollment, require_teacher_class
from ..services.notifications import sync_teacher_notifications
from ..services.reports import class_summary_pdf, review_pdf, roster_csv

router = APIRouter(prefix="/api/v1/teacher", tags=["teacher"])


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


def _join_code(db: Session) -> str:
    code = secrets.token_hex(3).upper()
    while db.scalar(select(Classroom.id).where(Classroom.join_code == code)):
        code = secrets.token_hex(3).upper()
    return code


def _get_teacher(db: Session, teacher_id: str) -> TeacherUser:
    user = db.get(TeacherUser, teacher_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Teacher not found or inactive")
    return user


@router.post("/register")
def register_teacher(data: TeacherRegisterIn, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    existing = db.scalar(select(TeacherUser).where(TeacherUser.email == email))
    if existing:
        raise HTTPException(status_code=409, detail="An account already exists for this email")
    user = TeacherUser(
        id=f"teacher-{uuid.uuid4().hex[:12]}",
        email=email,
        name=data.name.strip(),
        password_hash=_hash_password(data.password),
    )
    db.add(user)
    db.flush()
    db.add(TeacherSetting(teacher_id=user.id))
    audit(db, user.id, "teacher_registered", "teacher_user", user.id, {"email": email})
    db.commit()
    return {"ok": True, "profile": public_user(user)}


@router.post("/login")
def login_teacher(data: TeacherLoginIn, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    user = db.scalar(select(TeacherUser).where(TeacherUser.email == email))
    if not user or not user.password_hash or not _password_matches(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    user.last_login_at = datetime.utcnow()
    db.commit()
    return {"ok": True, "profile": public_user(user)}


@router.get("/classes")
def teacher_classes(
    teacher_id: str = Query(...),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher(db, teacher_id)
    assignments = db.scalars(
        select(TeacherClassAssignment)
        .where(TeacherClassAssignment.teacher_id == teacher.id)
        .order_by(TeacherClassAssignment.assigned_at.desc())
    ).all()
    by_class: dict[int, dict] = {}
    for a in assignments:
        classroom = db.get(Classroom, a.class_id)
        if not classroom:
            continue
        if classroom.id not in by_class:
            count = db.scalar(select(func.count()).select_from(StudentEnrollment).where(
                StudentEnrollment.class_id == classroom.id,
                StudentEnrollment.enrollment_status == "active",
            )) or 0
            by_class[classroom.id] = {
                "id": classroom.id,
                "name": classroom.name,
                "grade": classroom.grade,
                "join_code": classroom.join_code,
                "student_count": count,
                "created_at": classroom.created_at.isoformat(),
            }
    return list(by_class.values())


@router.post("/classes")
def create_teacher_class(
    payload: ClassCreateIn,
    teacher_id: str = Query(...),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher(db, teacher_id)
    item = Classroom(
        name=payload.name.strip(),
        grade=payload.grade.strip(),
        join_code=_join_code(db),
        created_by=teacher.id,
    )
    db.add(item)
    db.flush()
    db.add(TeacherClassAssignment(
        class_id=item.id,
        teacher_id=teacher.id,
        is_primary=True,
    ))
    audit(db, teacher.id, "class_created", "class", str(item.id), {"name": item.name, "grade": item.grade})
    db.commit()
    _auto_enroll_existing_students(item.id, item.grade)
    return {"id": item.id, "name": item.name, "grade": item.grade, "join_code": item.join_code}


def _auto_enroll_existing_students(class_id: int, grade: str):
    """Enroll all existing students of the same grade into the newly created class."""
    db2 = SessionLocal()
    try:
        stmt = select(Classroom).where(Classroom.grade == grade)
        classes = db2.execute(stmt).scalars().all()
        grade_class_ids = {c.id for c in classes}

        stmt2 = select(StudentEnrollment).where(
            StudentEnrollment.class_id.in_(grade_class_ids),
            StudentEnrollment.enrollment_status == "active",
        )
        existing_enrollments = db2.execute(stmt2).scalars().all()

        stmt_check = select(StudentEnrollment).where(
            StudentEnrollment.class_id == class_id,
            StudentEnrollment.enrollment_status == "active",
        )
        already_in_class = {e.student_id for e in db2.execute(stmt_check).scalars().all()}

        stmt3 = select(Classroom).where(Classroom.id == class_id)
        target_class = db2.execute(stmt3).scalar_one_or_none()
        if not target_class:
            return

        # Dedupe by student_id — the same student appears once per class they
        # are already in; inserting them twice trips UNIQUE(class_id, student_id)
        # and the rollback would discard the entire batch.
        seen: set[str] = set()
        enrolled_ids: list[str] = []
        for e in existing_enrollments:
            if e.student_id in already_in_class or e.student_id in seen:
                continue
            seen.add(e.student_id)
            enrollment = StudentEnrollment(
                class_id=class_id,
                student_id=e.student_id,
                student_name=e.student_name,
                student_email=e.student_email,
                progress=0,
                status="green",
            )
            db2.add(enrollment)
            enrolled_ids.append(e.student_id)

        db2.commit()
    except Exception:
        import logging
        logging.getLogger(__name__).exception("Auto-enroll into new class %d failed", class_id)
        db2.rollback()
        enrolled_ids = []
    finally:
        db2.close()

    # Mirror into JSON twins so the student's Profile "My Classes" matches SQL.
    if enrolled_ids:
        try:
            from ..core import store as twin_store
            for sid in enrolled_ids:
                twin = twin_store.load(sid) or {}
                merged = set(twin.get("enrolled_classes") or [])
                if class_id not in merged:
                    merged.add(class_id)
                    twin_store.update(sid, {"enrolled_classes": sorted(merged)})
        except Exception:
            import logging
            logging.getLogger(__name__).exception(
                "Twin enrolled_classes sync failed for new class %d", class_id
            )


@router.get("/roster")
def roster(
    class_id: int = Query(...),
    q: str | None = Query(default=None),
    status: str | None = Query(default=None),
    risk_level: str | None = Query(default=None),
    teacher_id: str = Query(...),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher(db, teacher_id)
    require_teacher_class(db, teacher.id, class_id)
    enrollments = db.scalars(select(StudentEnrollment).where(
        StudentEnrollment.class_id == class_id,
        StudentEnrollment.enrollment_status == "active",
    )).all()
    result = []
    for e in enrollments:
        risk = student_academic_risk(db, e.student_id, class_id, e)
        row = {
            "id": e.student_id,
            "name": e.student_name,
            "email": e.student_email,
            "class_id": class_id,
            "progress": e.progress,
            "status": e.status,
            "xp": e.xp,
            "badge": e.badge,
            "academic_risk": risk,
        }
        result.append(row)
    if q:
        needle = q.strip().lower()
        result = [r for r in result if needle in f"{r['name']} {r['email']}".lower()]
    if status:
        result = [r for r in result if r["status"] == status]
    if risk_level:
        result = [r for r in result if r["academic_risk"]["level"] == risk_level]
    return result


@router.get("/dashboard")
def dashboard(
    class_id: int = Query(...),
    teacher_id: str = Query(...),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher(db, teacher_id)
    require_teacher_class(db, teacher.id, class_id)
    settings = db.scalar(select(TeacherSetting).where(TeacherSetting.teacher_id == teacher.id))
    threshold = settings.risk_threshold if settings else 40
    snapshot = dashboard_snapshot(db, teacher.id, class_id, threshold)
    sync_teacher_notifications(db, teacher.id, class_id)
    db.commit()
    snapshot["unread_notifications"] = len(db.scalars(select(Notification).where(
        Notification.user_id == teacher.id, Notification.is_read.is_(False)
    )).all())
    return snapshot


@router.get("/notifications")
def notifications(
    teacher_id: str = Query(...),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher(db, teacher_id)
    rows = db.scalars(select(Notification).where(
        Notification.user_id == teacher.id
    ).order_by(Notification.created_at.desc()).limit(20)).all()
    return [{
        "id": n.id, "type": n.type, "severity": n.severity, "title": n.title,
        "message": n.message, "is_read": n.is_read, "created_at": n.created_at.isoformat(),
    } for n in rows]


@router.post("/notifications/mark-read")
def mark_notifications_read(
    teacher_id: str = Query(...),
    notification_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher(db, teacher_id)
    if notification_id:
        n = db.get(Notification, notification_id)
        if n and n.user_id == teacher.id:
            n.is_read = True
    else:
        rows = db.scalars(select(Notification).where(
            Notification.user_id == teacher.id, Notification.is_read.is_(False)
        )).all()
        for n in rows:
            n.is_read = True
    db.commit()
    return {"ok": True}


@router.get("/classes/{class_id}/students")
def class_students(
    class_id: int,
    teacher_id: str = Query(...),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher(db, teacher_id)
    require_teacher_class(db, teacher.id, class_id)
    enrollments = db.scalars(select(StudentEnrollment).where(
        StudentEnrollment.class_id == class_id,
        StudentEnrollment.enrollment_status == "active",
    )).all()
    return [{
        "id": e.student_id, "name": e.student_name, "email": e.student_email,
        "progress": e.progress, "status": e.status, "xp": e.xp, "badge": e.badge,
    } for e in enrollments]


@router.post("/classes/{class_id}/students")
def create_student_for_class(
    class_id: int,
    payload: StudentCreateIn,
    teacher_id: str = Query(...),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher(db, teacher_id)
    require_teacher_class(db, teacher.id, class_id)
    email = payload.email.strip().lower()
    existing = db.scalar(select(StudentEnrollment).where(
        StudentEnrollment.class_id == class_id,
        StudentEnrollment.student_email == email,
        StudentEnrollment.enrollment_status == "active",
    ))
    if existing:
        raise HTTPException(status_code=409, detail="Student already enrolled in this class")
    student_id = f"student-{uuid.uuid4().hex[:12]}"
    enrollment = StudentEnrollment(
        class_id=class_id,
        student_id=student_id,
        student_name=payload.name.strip(),
        student_email=email,
        progress=payload.progress,
        status=payload.status,
        xp=payload.xp,
        badge=payload.badge,
    )
    db.add(enrollment)
    # Create a login-capable twin so the student can sign in with the password
    # the teacher set (otherwise the email has no password_hash and login 401s).
    if payload.password:
        from ..core import store as twin_store
        twin_store.ensure(
            student_id,
            defaults={
                "name": payload.name.strip(),
                "email": email,
                "role": "student",
                "grade": db.get(Classroom, class_id).grade if db.get(Classroom, class_id) else "5th",
                "password_hash": _hash_password(payload.password),
            },
        )
    # Link the class in the twin's enrolled_classes (create twin if needed) so
    # the student sees it — not only when a password was supplied.
    from ..core import store as twin_store
    if not twin_store.load(student_id):
        cls = db.get(Classroom, class_id)
        twin_store.ensure(
            student_id,
            defaults={
                "name": payload.name.strip(),
                "email": email,
                "role": "student",
                "grade": cls.grade if cls else "5th",
            },
        )
    twin = twin_store.load(student_id) or {}
    enrolled = set(twin.get("enrolled_classes") or [])
    enrolled.add(class_id)
    twin_store.update(student_id, {"enrolled_classes": sorted(enrolled)})
    audit(db, teacher.id, "student_enrolled", "student", student_id, {"class_id": class_id})
    db.commit()
    return {"student_id": student_id, "ok": True}


@router.patch("/classes/{class_id}/students/{student_id}/enrollment")
def update_enrollment(
    class_id: int,
    student_id: str,
    payload: EnrollmentUpdateIn,
    teacher_id: str = Query(...),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher(db, teacher_id)
    require_teacher_class(db, teacher.id, class_id)
    enrollment = require_enrollment(db, class_id, student_id)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(enrollment, key, value)
    audit(db, teacher.id, "enrollment_updated", "student", student_id, {"class_id": class_id, **data})
    db.commit()
    return {"ok": True}


@router.get("/classes/{class_id}/student/{student_id}")
def student_profile(
    class_id: int,
    student_id: str,
    teacher_id: str = Query(...),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher(db, teacher_id)
    require_teacher_class(db, teacher.id, class_id)
    enrollment = require_enrollment(db, class_id, student_id)
    submissions = db.scalars(
        select(Submission)
        .join(Assessment, Assessment.id == Submission.assessment_id)
        .where(Submission.student_id == student_id, Assessment.class_id == class_id)
        .order_by(Submission.submitted_at.desc())
    ).all()
    # Pull twin-side exam history + live XP so practice quizzes show on the roster.
    exam_history = []
    twin_xp = enrollment.xp
    twin_badge = enrollment.badge
    try:
        from ..core import store as twin_store
        twin = twin_store.load(student_id) or {}
        exam_history = (twin.get("exam_history") or [])[-15:]
        twin_xp = int(twin.get("xp", enrollment.xp or 0) or 0)
        twin_badge = twin.get("badge") or enrollment.badge or "Bronze"
    except Exception:
        pass
    return {
        "student": {"id": enrollment.student_id, "name": enrollment.student_name, "email": enrollment.student_email},
        "class_id": class_id,
        "progress": enrollment.progress,
        "status": enrollment.status,
        "xp": twin_xp,
        "badge": twin_badge,
        "academic_risk": student_academic_risk(db, student_id, class_id, enrollment),
        "exam_history": exam_history,
        "submissions": [{
            "id": s.id,
            "assessment_id": s.assessment_id,
            "assessment": db.get(Assessment, s.assessment_id).title,
            "attempt_no": s.attempt_no,
            "raw_score": s.raw_score,
            "max_score": db.get(Assessment, s.assessment_id).max_score,
            "percentage": s.percentage,
            "ai_score": s.ai_score,
            "overridden": s.teacher_overridden,
            "misconception": s.misconception,
            "teacher_feedback": s.teacher_feedback,
            "submitted_at": s.submitted_at.isoformat(),
        } for s in submissions],
    }


@router.get("/classes/{class_id}/student/{student_id}/analytics")
def student_analytics_endpoint(
    class_id: int,
    student_id: str,
    teacher_id: str = Query(...),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher(db, teacher_id)
    require_teacher_class(db, teacher.id, class_id)
    require_enrollment(db, class_id, student_id)
    return student_analytics(db, student_id, class_id)


@router.get("/classes/{class_id}/assessments")
def class_assessments(
    class_id: int,
    teacher_id: str = Query(...),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher(db, teacher_id)
    require_teacher_class(db, teacher.id, class_id)
    items = db.scalars(select(Assessment).where(Assessment.class_id == class_id).order_by(Assessment.created_at.desc())).all()
    return [{
        "id": a.id, "title": a.title, "status": a.status, "max_score": a.max_score,
        "weight": a.weight, "attempt_limit": a.attempt_limit,
        "due_at": a.due_at.isoformat() if a.due_at else None,
    } for a in items]


@router.post("/classes/{class_id}/assessments")
def create_assessment(
    class_id: int,
    payload: AssessmentCreateIn,
    teacher_id: str = Query(...),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher(db, teacher_id)
    require_teacher_class(db, teacher.id, class_id)
    item = Assessment(
        class_id=class_id,
        created_by=teacher.id,
        title=payload.title.strip(),
        status=payload.status,
        max_score=payload.max_score,
        weight=payload.weight,
        attempt_limit=payload.attempt_limit,
        due_at=payload.due_at,
    )
    db.add(item)
    db.flush()
    audit(db, teacher.id, "assessment_created", "assessment", str(item.id), {"class_id": class_id, "title": item.title})
    db.commit()
    return {"id": item.id, "title": item.title, "max_score": item.max_score, "status": item.status}


@router.post("/submissions")
def create_submission(
    payload: SubmissionCreateIn,
    teacher_id: str = Query(...),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher(db, teacher_id)
    assessment = db.get(Assessment, payload.assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    require_teacher_class(db, teacher.id, assessment.class_id)
    require_enrollment(db, assessment.class_id, payload.student_id)
    if payload.raw_score > assessment.max_score:
        raise HTTPException(status_code=400, detail=f"raw_score cannot exceed max_score ({assessment.max_score})")
    if payload.attempt_no is None:
        last_attempt = db.scalar(select(func.max(Submission.attempt_no)).where(
            Submission.assessment_id == assessment.id,
            Submission.student_id == payload.student_id,
        )) or 0
        attempt_no = last_attempt + 1
    else:
        attempt_no = payload.attempt_no
    if attempt_no > assessment.attempt_limit:
        raise HTTPException(status_code=400, detail=f"Attempt limit is {assessment.attempt_limit}")
    if db.scalar(select(Submission.id).where(
        Submission.assessment_id == assessment.id,
        Submission.student_id == payload.student_id,
        Submission.attempt_no == attempt_no,
    )):
        raise HTTPException(status_code=409, detail="This attempt number already exists")
    percentage = round((payload.raw_score / assessment.max_score) * 100, 2)
    item = Submission(
        assessment_id=assessment.id,
        student_id=payload.student_id,
        attempt_no=attempt_no,
        raw_score=payload.raw_score,
        percentage=percentage,
        ai_score=payload.ai_score,
        misconception=payload.misconception.strip() if payload.misconception else None,
        teacher_feedback=payload.teacher_feedback.strip() if payload.teacher_feedback else None,
        submitted_at=payload.submitted_at or datetime.utcnow(),
    )
    db.add(item)
    db.flush()
    audit(db, teacher.id, "submission_created", "submission", str(item.id), {
        "assessment_id": assessment.id, "student_id": payload.student_id,
        "raw_score": payload.raw_score, "percentage": percentage, "attempt_no": attempt_no,
    })
    db.commit()
    return {"id": item.id, "percentage": percentage, "attempt_no": attempt_no, "ok": True}


@router.post("/override")
def override_grade(
    payload: GradeOverrideIn,
    teacher_id: str = Query(...),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher(db, teacher_id)
    item = db.get(Submission, payload.submission_id)
    if not item:
        raise HTTPException(status_code=404, detail="Submission not found")
    assessment = db.get(Assessment, item.assessment_id)
    require_teacher_class(db, teacher.id, assessment.class_id)
    old_percentage = item.percentage
    item.percentage = payload.new_percentage
    item.raw_score = round((payload.new_percentage / 100) * assessment.max_score, 4)
    item.teacher_overridden = True
    item.override_reason = payload.reason.strip()
    audit(db, teacher.id, "grade_overridden", "submission", str(item.id), {
        "old_percentage": old_percentage, "new_percentage": item.percentage,
        "new_raw_score": item.raw_score, "reason": item.override_reason,
    })
    db.commit()
    return {"ok": True, "submission_id": item.id, "percentage": item.percentage, "raw_score": item.raw_score}


@router.get("/submissions")
def submissions(
    class_id: int = Query(...),
    teacher_id: str = Query(...),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher(db, teacher_id)
    require_teacher_class(db, teacher.id, class_id)
    stmt = select(Submission).join(Assessment, Assessment.id == Submission.assessment_id).where(Assessment.class_id == class_id)
    rows = db.scalars(stmt.order_by(Submission.submitted_at.desc())).all()
    result = []
    for s in rows:
        assessment = db.get(Assessment, s.assessment_id)
        enrollment = db.scalar(select(StudentEnrollment).where(
            StudentEnrollment.student_id == s.student_id,
            StudentEnrollment.class_id == class_id,
        ))
        result.append({
            "id": s.id,
            "student_id": s.student_id,
            "student": enrollment.student_name if enrollment else s.student_id,
            "assessment_id": s.assessment_id,
            "assessment": assessment.title if assessment else str(s.assessment_id),
            "attempt_no": s.attempt_no,
            "raw_score": s.raw_score,
            "max_score": assessment.max_score if assessment else None,
            "percentage": s.percentage,
            "ai_score": s.ai_score,
            "teacher_overridden": s.teacher_overridden,
            "override_reason": s.override_reason,
            "misconception": s.misconception,
            "teacher_feedback": s.teacher_feedback,
            "submitted_at": s.submitted_at.isoformat(),
        })
    return result


@router.get("/assessments/analytics")
def assessments_analytics(
    class_id: int = Query(...),
    teacher_id: str = Query(...),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher(db, teacher_id)
    require_teacher_class(db, teacher.id, class_id)
    return assessment_analytics(db, class_id)


@router.get("/misconceptions")
def misconceptions(
    class_id: int = Query(...),
    teacher_id: str = Query(...),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher(db, teacher_id)
    require_teacher_class(db, teacher.id, class_id)
    rows = db.scalars(
        select(Submission)
        .join(Assessment, Assessment.id == Submission.assessment_id)
        .where(Assessment.class_id == class_id, Submission.misconception.is_not(None))
    ).all()
    grouped: dict[str, list[Submission]] = defaultdict(list)
    for s in rows:
        if s.misconception and s.misconception.strip():
            grouped[s.misconception.strip()].append(s)
    result = []
    for name, items in grouped.items():
        student_ids = sorted({x.student_id for x in items})
        enrollments = [db.scalar(select(StudentEnrollment).where(
            StudentEnrollment.student_id == sid,
            StudentEnrollment.class_id == class_id,
        )) for sid in student_ids]
        students = [e.student_name for e in enrollments if e]
        result.append({
            "misconception": name,
            "students": students,
            "student_ids": student_ids,
            "occurrences": len(items),
            "average_score": round(mean([x.percentage for x in items]), 1),
        })
    return sorted(result, key=lambda x: (x["occurrences"], len(x["students"])), reverse=True)


@router.get("/classes/{class_id}/student/{student_id}/notes")
def student_notes(
    class_id: int,
    student_id: str,
    teacher_id: str = Query(...),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher(db, teacher_id)
    require_teacher_class(db, teacher.id, class_id)
    require_enrollment(db, class_id, student_id)
    notes = db.scalars(select(TeacherNote).where(
        TeacherNote.teacher_id == teacher.id,
        TeacherNote.student_id == student_id,
        TeacherNote.class_id == class_id,
    ).order_by(TeacherNote.pinned.desc(), TeacherNote.created_at.desc())).all()
    return [{
        "id": n.id, "note": n.note, "category": n.category, "pinned": n.pinned,
        "follow_up_at": n.follow_up_at.isoformat() if n.follow_up_at else None,
        "created_at": n.created_at.isoformat(),
    } for n in notes]


@router.post("/classes/{class_id}/student/{student_id}/notes")
def add_student_note(
    class_id: int,
    student_id: str,
    payload: TeacherNoteIn,
    teacher_id: str = Query(...),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher(db, teacher_id)
    require_teacher_class(db, teacher.id, class_id)
    require_enrollment(db, class_id, student_id)
    note = TeacherNote(
        teacher_id=teacher.id, student_id=student_id, class_id=class_id,
        note=payload.note.strip(), category=payload.category.strip().lower(),
        pinned=payload.pinned, follow_up_at=payload.follow_up_at,
    )
    db.add(note)
    db.flush()
    audit(db, teacher.id, "note_created", "teacher_note", str(note.id), {"student_id": student_id, "class_id": class_id})
    db.commit()
    return {"id": note.id, "ok": True}


@router.delete("/classes/{class_id}/student/{student_id}/notes/{note_id}")
def delete_note(
    class_id: int,
    student_id: str,
    note_id: int,
    teacher_id: str = Query(...),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher(db, teacher_id)
    require_teacher_class(db, teacher.id, class_id)
    note = db.get(TeacherNote, note_id)
    if not note or note.teacher_id != teacher.id or note.student_id != student_id or note.class_id != class_id:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(note)
    audit(db, teacher.id, "note_deleted", "teacher_note", str(note_id), {"student_id": student_id, "class_id": class_id})
    db.commit()
    return {"ok": True}


@router.get("/interventions/suggestions")
def suggested_interventions(
    class_id: int = Query(...),
    teacher_id: str = Query(...),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher(db, teacher_id)
    require_teacher_class(db, teacher.id, class_id)
    return intervention_suggestions(db, teacher.id, class_id)


@router.get("/interventions")
def interventions(
    class_id: int = Query(...),
    status: str | None = Query(default=None),
    teacher_id: str = Query(...),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher(db, teacher_id)
    require_teacher_class(db, teacher.id, class_id)
    stmt = select(InterventionTask).where(InterventionTask.teacher_id == teacher.id, InterventionTask.class_id == class_id)
    if status:
        stmt = stmt.where(InterventionTask.status == status)
    rows = db.scalars(stmt.order_by(InterventionTask.created_at.desc())).all()
    return [_intervention_payload(db, x) for x in rows]


def _intervention_payload(db: Session, item: InterventionTask):
    enrollment = db.scalar(select(StudentEnrollment).where(
        StudentEnrollment.student_id == item.student_id,
        StudentEnrollment.class_id == item.class_id,
    ))
    student_name = enrollment.student_name if enrollment else item.student_id
    improvement = None
    if item.baseline_score is not None and item.outcome_score is not None:
        improvement = round(item.outcome_score - item.baseline_score, 1)
    return {
        "id": item.id,
        "class_id": item.class_id,
        "student_id": item.student_id,
        "student": student_name,
        "title": item.title,
        "action_type": item.action_type,
        "priority": item.priority,
        "status": item.status,
        "source": item.source,
        "details": item.details,
        "due_at": item.due_at.isoformat() if item.due_at else None,
        "scheduled_at": item.scheduled_at.isoformat() if item.scheduled_at else None,
        "baseline_score": item.baseline_score,
        "outcome_score": item.outcome_score,
        "improvement": improvement,
        "outcome_notes": item.outcome_notes,
        "created_at": item.created_at.isoformat(),
        "completed_at": item.completed_at.isoformat() if item.completed_at else None,
    }


@router.post("/interventions")
def create_intervention(
    payload: InterventionCreateIn,
    teacher_id: str = Query(...),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher(db, teacher_id)
    require_teacher_class(db, teacher.id, payload.class_id)
    require_enrollment(db, payload.class_id, payload.student_id)
    analytics = student_analytics(db, payload.student_id, payload.class_id)
    item = InterventionTask(
        teacher_id=teacher.id,
        student_id=payload.student_id,
        class_id=payload.class_id,
        title=payload.title.strip(),
        action_type=payload.action_type,
        priority=payload.priority,
        status="scheduled" if payload.scheduled_at else "approved",
        source="teacher",
        details=payload.details,
        due_at=payload.due_at,
        scheduled_at=payload.scheduled_at,
        baseline_score=analytics.get("average_score"),
    )
    db.add(item)
    db.flush()
    audit(db, teacher.id, "intervention_created", "intervention", str(item.id), {"student_id": item.student_id, "class_id": item.class_id})
    db.commit()
    return _intervention_payload(db, item)


@router.post("/interventions/from-suggestion")
def create_from_suggestion(
    class_id: int,
    student_id: str,
    teacher_id: str = Query(...),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher(db, teacher_id)
    require_teacher_class(db, teacher.id, class_id)
    match = next((x for x in intervention_suggestions(db, teacher.id, class_id) if x["student_id"] == student_id), None)
    if not match:
        raise HTTPException(status_code=404, detail="No current suggestion for this student")
    item = InterventionTask(
        teacher_id=teacher.id,
        student_id=student_id,
        class_id=class_id,
        title=match["title"],
        action_type=match["action_type"],
        priority=match["priority"],
        status="suggested",
        source="risk_engine",
        details=match["details"],
        baseline_score=match["risk"].get("average_score"),
    )
    db.add(item)
    db.flush()
    audit(db, teacher.id, "intervention_created_from_suggestion", "intervention", str(item.id), {"student_id": student_id, "class_id": class_id})
    db.commit()
    return _intervention_payload(db, item)


_ALLOWED_TRANSITIONS = {
    "suggested": {"approved", "dismissed"},
    "approved": {"scheduled", "in_progress", "dismissed"},
    "scheduled": {"in_progress", "dismissed"},
    "in_progress": {"completed", "dismissed"},
    "completed": {"outcome_review"},
    "outcome_review": set(),
    "dismissed": set(),
}


@router.patch("/interventions/{intervention_id}")
def update_intervention(
    intervention_id: int,
    payload: InterventionUpdateIn,
    teacher_id: str = Query(...),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher(db, teacher_id)
    item = db.get(InterventionTask, intervention_id)
    if not item or item.teacher_id != teacher.id:
        raise HTTPException(status_code=404, detail="Intervention not found")
    require_teacher_class(db, teacher.id, item.class_id)
    data = payload.model_dump(exclude_unset=True)
    new_status = data.get("status")
    if new_status and new_status != item.status:
        if new_status not in _ALLOWED_TRANSITIONS.get(item.status, set()):
            raise HTTPException(status_code=400, detail=f"Invalid status transition: {item.status} -> {new_status}")
        if new_status == "completed":
            item.completed_at = datetime.utcnow()
            if data.get("outcome_score") is None:
                current = student_analytics(db, item.student_id, item.class_id).get("average_score")
                data["outcome_score"] = current
    for key, value in data.items():
        setattr(item, key, value)
    audit(db, teacher.id, "intervention_updated", "intervention", str(item.id), data)
    db.commit()
    return _intervention_payload(db, item)


@router.get("/settings")
def get_settings(
    teacher_id: str = Query(...),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher(db, teacher_id)
    item = db.scalar(select(TeacherSetting).where(TeacherSetting.teacher_id == teacher.id))
    if not item:
        item = TeacherSetting(teacher_id=teacher.id)
        db.add(item)
        db.commit()
    return {"notifications": item.notifications, "risk_threshold": item.risk_threshold}


@router.put("/settings")
def put_settings(
    payload: TeacherSettingsIn,
    teacher_id: str = Query(...),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher(db, teacher_id)
    item = db.scalar(select(TeacherSetting).where(TeacherSetting.teacher_id == teacher.id))
    if not item:
        item = TeacherSetting(teacher_id=teacher.id)
        db.add(item)
    item.notifications = payload.notifications
    item.risk_threshold = payload.risk_threshold
    audit(db, teacher.id, "settings_updated", "teacher_settings", teacher.id, payload.model_dump())
    db.commit()
    return {"ok": True, **payload.model_dump()}


@router.get("/audit-log")
def audit_log(
    limit: int = Query(default=100, ge=1, le=500),
    teacher_id: str = Query(...),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher(db, teacher_id)
    rows = db.scalars(select(AuditLog).where(AuditLog.actor_user_id == teacher.id).order_by(AuditLog.created_at.desc()).limit(limit)).all()
    return [{
        "id": x.id, "action": x.action, "entity_type": x.entity_type, "entity_id": x.entity_id,
        "details": x.details, "created_at": x.created_at.isoformat(),
    } for x in rows]


@router.get("/reports/progress.csv")
def progress_csv(
    class_id: int = Query(...),
    teacher_id: str = Query(...),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher(db, teacher_id)
    require_teacher_class(db, teacher.id, class_id)
    enrollments = db.scalars(select(StudentEnrollment).where(
        StudentEnrollment.class_id == class_id,
        StudentEnrollment.enrollment_status == "active",
    )).all()
    rows = []
    for e in enrollments:
        risk = student_academic_risk(db, e.student_id, class_id, e)
        rows.append({
            "name": e.student_name, "email": e.student_email,
            "progress": e.progress, "status": e.status,
            "academic_risk": risk,
        })
    return Response(roster_csv(rows), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=class_{class_id}_progress.csv"})


@router.get("/reports/review.pdf")
def misconception_review_pdf(
    class_id: int = Query(...),
    teacher_id: str = Query(...),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher(db, teacher_id)
    classroom = require_teacher_class(db, teacher.id, class_id)
    bins = misconceptions(class_id, teacher_id, db)
    return Response(review_pdf(f"{classroom.name} - Misconception Review", bins), media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=class_{class_id}_misconceptions.pdf"})


@router.get("/reports/class-summary.pdf")
def class_summary(
    class_id: int = Query(...),
    teacher_id: str = Query(...),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher(db, teacher_id)
    classroom = require_teacher_class(db, teacher.id, class_id)
    settings = db.scalar(select(TeacherSetting).where(TeacherSetting.teacher_id == teacher.id))
    snapshot = dashboard_snapshot(db, teacher.id, class_id, settings.risk_threshold if settings else 40)
    return Response(class_summary_pdf(classroom.name, snapshot), media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=class_{class_id}_summary.pdf"})
