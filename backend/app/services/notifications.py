from __future__ import annotations

from datetime import datetime
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import InterventionTask, Notification, TeacherSetting
from .analytics import dashboard_snapshot


def _upsert_notification(db: Session, user_id: str, *, type_: str, severity: str, title: str, message: str, entity_type: str | None, entity_id: str | None, dedupe_key: str):
    existing = db.scalar(select(Notification).where(Notification.dedupe_key == dedupe_key))
    if existing:
        existing.severity = severity
        existing.title = title
        existing.message = message
        return existing
    item = Notification(
        user_id=user_id,
        type=type_,
        severity=severity,
        title=title,
        message=message,
        entity_type=entity_type,
        entity_id=entity_id,
        dedupe_key=dedupe_key,
    )
    db.add(item)
    return item


def sync_teacher_notifications(db: Session, teacher_id: str, class_id: int) -> int:
    settings = db.scalar(select(TeacherSetting).where(TeacherSetting.teacher_id == teacher_id))
    threshold = settings.risk_threshold if settings else 40
    snapshot = dashboard_snapshot(db, teacher_id, class_id, threshold)
    created = 0
    for item in snapshot["risk_students"]:
        risk = item["risk"]
        if risk["score"] < threshold:
            continue
        before = db.scalar(select(Notification).where(Notification.dedupe_key == f"risk:{teacher_id}:{class_id}:{item['student_id']}"))
        _upsert_notification(
            db, teacher_id,
            type_="academic_risk",
            severity=risk["level"],
            title=f"{item['name']} needs review",
            message="; ".join(r["message"] for r in risk["reasons"][:2]) or "Academic risk threshold crossed.",
            entity_type="student",
            entity_id=item["student_id"],
            dedupe_key=f"risk:{teacher_id}:{class_id}:{item['student_id']}",
        )
        created += 0 if before else 1
    overdue = db.scalars(select(InterventionTask).where(
        InterventionTask.teacher_id == teacher_id,
        InterventionTask.class_id == class_id,
        InterventionTask.due_at.is_not(None),
        InterventionTask.status.not_in(["completed", "dismissed"]),
        InterventionTask.due_at < datetime.utcnow(),
    )).all()
    for task in overdue:
        before = db.scalar(select(Notification).where(Notification.dedupe_key == f"intervention-overdue:{task.id}"))
        _upsert_notification(
            db, teacher_id,
            type_="overdue_intervention",
            severity="high",
            title=f"Overdue action: {task.title}",
            message=f"This intervention was due at {task.due_at.isoformat()}.",
            entity_type="intervention",
            entity_id=str(task.id),
            dedupe_key=f"intervention-overdue:{task.id}",
        )
        created += 0 if before else 1
    return created
