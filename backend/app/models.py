from __future__ import annotations

from datetime import date, datetime
from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, JSON, String, Text, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .core.database import Base


class Classroom(Base):
    __tablename__ = "classrooms"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    grade: Mapped[str] = mapped_column(String(80), index=True)
    join_code: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    created_by: Mapped[str | None] = mapped_column(ForeignKey("teacher_users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TeacherUser(Base):
    __tablename__ = "teacher_users"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    password_hash: Mapped[str] = mapped_column(String(512))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class TeacherClassAssignment(Base):
    __tablename__ = "teacher_class_assignments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classrooms.id", ondelete="CASCADE"), index=True)
    teacher_id: Mapped[str] = mapped_column(ForeignKey("teacher_users.id", ondelete="CASCADE"), index=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    __table_args__ = (UniqueConstraint("class_id", "teacher_id", name="uq_teacher_class"),)


class StudentEnrollment(Base):
    __tablename__ = "student_enrollments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classrooms.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[str] = mapped_column(String(64), index=True)
    student_name: Mapped[str] = mapped_column(String(255))
    student_email: Mapped[str] = mapped_column(String(255))
    progress: Mapped[float] = mapped_column(Float, default=0)
    status: Mapped[str] = mapped_column(String(20), default="green", index=True)
    xp: Mapped[int] = mapped_column(Integer, default=0)
    badge: Mapped[str] = mapped_column(String(30), default="Bronze")
    enrollment_status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    enrolled_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    __table_args__ = (UniqueConstraint("class_id", "student_id", name="uq_class_student"),)


class Assessment(Base):
    __tablename__ = "assessments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classrooms.id", ondelete="CASCADE"), index=True)
    created_by: Mapped[str] = mapped_column(ForeignKey("teacher_users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), default="draft", index=True)
    max_score: Mapped[float] = mapped_column(Float, default=100)
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    attempt_limit: Mapped[int] = mapped_column(Integer, default=1)
    due_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Submission(Base):
    __tablename__ = "submissions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    assessment_id: Mapped[int] = mapped_column(ForeignKey("assessments.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[str] = mapped_column(String(64), index=True)
    attempt_no: Mapped[int] = mapped_column(Integer, default=1)
    raw_score: Mapped[float] = mapped_column(Float)
    percentage: Mapped[float] = mapped_column(Float, index=True)
    ai_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    teacher_overridden: Mapped[bool] = mapped_column(Boolean, default=False)
    override_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    misconception: Mapped[str | None] = mapped_column(String(255), index=True)
    teacher_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    __table_args__ = (UniqueConstraint("assessment_id", "student_id", "attempt_no", name="uq_submission_attempt"),)


class TeacherNote(Base):
    __tablename__ = "teacher_notes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    teacher_id: Mapped[str] = mapped_column(ForeignKey("teacher_users.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[str] = mapped_column(String(64), index=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classrooms.id", ondelete="CASCADE"), index=True)
    note: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(30), default="general", index=True)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    follow_up_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class InterventionTask(Base):
    __tablename__ = "intervention_tasks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    teacher_id: Mapped[str] = mapped_column(ForeignKey("teacher_users.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[str] = mapped_column(String(64), index=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classrooms.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    action_type: Mapped[str] = mapped_column(String(50), default="follow_up", index=True)
    priority: Mapped[str] = mapped_column(String(20), default="medium", index=True)
    status: Mapped[str] = mapped_column(String(30), default="approved", index=True)
    source: Mapped[str] = mapped_column(String(30), default="teacher", index=True)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    baseline_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    outcome_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    outcome_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("teacher_users.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(50), index=True)
    severity: Mapped[str] = mapped_column(String(20), default="info", index=True)
    title: Mapped[str] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(Text)
    entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    entity_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    dedupe_key: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class TeacherSetting(Base):
    __tablename__ = "teacher_settings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    teacher_id: Mapped[str] = mapped_column(ForeignKey("teacher_users.id", ondelete="CASCADE"), unique=True, index=True)
    notifications: Mapped[bool] = mapped_column(Boolean, default=True)
    risk_threshold: Mapped[int] = mapped_column(Integer, default=40)


class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor_user_id: Mapped[str] = mapped_column(String(64), index=True)
    action: Mapped[str] = mapped_column(String(80), index=True)
    entity_type: Mapped[str] = mapped_column(String(50), index=True)
    entity_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


Index("ix_submissions_student_assessment", Submission.student_id, Submission.assessment_id)
Index("ix_interventions_teacher_status", InterventionTask.teacher_id, InterventionTask.status)
Index("ix_enrollment_class_student", StudentEnrollment.class_id, StudentEnrollment.student_id)
Index("ix_assignment_teacher_class", TeacherClassAssignment.teacher_id, TeacherClassAssignment.class_id)
