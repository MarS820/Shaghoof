from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import AuditLog, Classroom, StudentEnrollment, TeacherClassAssignment, TeacherUser


def audit(db: Session, actor_user_id: str, action: str, entity_type: str, entity_id: str | None = None, details: dict | None = None):
    db.add(AuditLog(
        actor_user_id=actor_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details or {},
    ))


def teacher_has_class(db: Session, teacher_id: str, class_id: int) -> bool:
    return db.scalar(select(TeacherClassAssignment.id).where(
        TeacherClassAssignment.teacher_id == teacher_id,
        TeacherClassAssignment.class_id == class_id,
    )) is not None


def require_teacher_class(db: Session, teacher_id: str, class_id: int) -> Classroom:
    classroom = db.get(Classroom, class_id)
    if not classroom or not teacher_has_class(db, teacher_id, class_id):
        raise HTTPException(status_code=404, detail="Class not found or not assigned to this teacher")
    return classroom


def is_enrolled(db: Session, class_id: int, student_id: str) -> bool:
    return db.scalar(select(StudentEnrollment.id).where(
        StudentEnrollment.class_id == class_id,
        StudentEnrollment.student_id == student_id,
        StudentEnrollment.enrollment_status == "active",
    )) is not None


def require_enrollment(db: Session, class_id: int, student_id: str) -> StudentEnrollment:
    item = db.scalar(select(StudentEnrollment).where(
        StudentEnrollment.class_id == class_id,
        StudentEnrollment.student_id == student_id,
        StudentEnrollment.enrollment_status == "active",
    ))
    if not item:
        raise HTTPException(status_code=404, detail="Student is not enrolled in this class")
    return item


def public_user(user: TeacherUser) -> dict:
    return {
        "id": user.id,
        "user_id": user.id,
        "role": "teacher",
        "name": user.name,
        "email": user.email,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat(),
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
    }
