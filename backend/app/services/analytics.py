from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime
from statistics import mean

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Assessment, InterventionTask, StudentEnrollment, Submission, TeacherClassAssignment


def _round(value: float | None, digits: int = 1):
    return round(float(value), digits) if value is not None else None


def teacher_class_ids(db: Session, teacher_id: str) -> list[int]:
    return [x[0] for x in db.execute(select(TeacherClassAssignment.class_id).where(TeacherClassAssignment.teacher_id == teacher_id).distinct()).all()]


def teacher_student_ids(db: Session, teacher_id: str, class_id: int | None = None) -> list[str]:
    ids = [class_id] if class_id is not None else teacher_class_ids(db, teacher_id)
    if not ids:
        return []
    return list({x[0] for x in db.execute(select(StudentEnrollment.student_id).where(
        StudentEnrollment.class_id.in_(ids), StudentEnrollment.enrollment_status == "active"
    )).all()})


def _latest_submission_per_assessment(db: Session, student_id: str, class_id: int) -> list[Submission]:
    rows = db.scalars(
        select(Submission)
        .join(Assessment, Assessment.id == Submission.assessment_id)
        .where(Submission.student_id == student_id, Assessment.class_id == class_id)
        .order_by(Submission.submitted_at.asc(), Submission.id.asc())
    ).all()
    latest: dict[int, Submission] = {}
    for row in rows:
        current = latest.get(row.assessment_id)
        if current is None or (row.attempt_no, row.submitted_at, row.id) >= (current.attempt_no, current.submitted_at, current.id):
            latest[row.assessment_id] = row
    return sorted(latest.values(), key=lambda s: (s.submitted_at, s.id))


def student_academic_risk(db: Session, student_id: str, class_id: int, enrollment: StudentEnrollment | None = None) -> dict:
    enrollment = enrollment or db.scalar(select(StudentEnrollment).where(
        StudentEnrollment.class_id == class_id,
        StudentEnrollment.student_id == student_id,
    ))
    progress = enrollment.progress if enrollment else 0
    submissions = _latest_submission_per_assessment(db, student_id, class_id)
    scores = [s.percentage for s in submissions]
    average_score = mean(scores) if scores else None

    trend = "insufficient_data"
    trend_delta = None
    if len(scores) >= 2:
        trend_delta = scores[-1] - scores[0]
        if trend_delta <= -10:
            trend = "declining"
        elif trend_delta >= 10:
            trend = "improving"
        else:
            trend = "stable"

    misconceptions = [s.misconception.strip() for s in submissions if s.misconception and s.misconception.strip()]
    counts = Counter(misconceptions)
    repeated = [(name, count) for name, count in counts.items() if count >= 2]

    score = 0.0
    reasons: list[dict] = []

    if progress < 70:
        penalty = min(35.0, max(0.0, (70 - progress) / 70 * 35))
        score += penalty
        reasons.append({
            "code": "low_progress",
            "message": f"Class progress is {progress:.1f}% (below 70%).",
            "value": _round(progress),
            "weight": _round(penalty),
        })

    if average_score is not None and average_score < 70:
        penalty = min(30.0, max(0.0, (70 - average_score) / 70 * 30))
        score += penalty
        reasons.append({
            "code": "low_average_score",
            "message": f"Average assessment score is {average_score:.1f}%.",
            "value": _round(average_score),
            "weight": _round(penalty),
        })

    if trend == "declining":
        penalty = min(20.0, 10.0 + min(10.0, abs(trend_delta or 0) / 2))
        score += penalty
        reasons.append({
            "code": "declining_trend",
            "message": f"Assessment trend declined by {abs(trend_delta or 0):.1f} points from first to latest assessment.",
            "value": _round(trend_delta),
            "weight": _round(penalty),
        })

    if repeated:
        repetitions = sum(count - 1 for _, count in repeated)
        penalty = min(15.0, 5.0 + repetitions * 2.5)
        score += penalty
        top_name, top_count = max(repeated, key=lambda x: x[1])
        reasons.append({
            "code": "repeated_misconception",
            "message": f"Repeated misconception: {top_name} ({top_count} assessments).",
            "value": top_count,
            "weight": _round(penalty),
        })

    score = min(100.0, score)
    if score >= 75:
        level = "critical"
    elif score >= 50:
        level = "high"
    elif score >= 25:
        level = "medium"
    else:
        level = "low"

    return {
        "score": _round(score),
        "level": level,
        "reasons": reasons,
        "progress": _round(progress),
        "average_score": _round(average_score),
        "trend": trend,
        "trend_delta": _round(trend_delta),
        "repeated_misconceptions": [{"name": n, "count": c} for n, c in sorted(repeated, key=lambda x: x[1], reverse=True)],
        "calculated_at": datetime.utcnow().isoformat(),
    }


def student_analytics(db: Session, student_id: str, class_id: int) -> dict:
    enrollment = db.scalar(select(StudentEnrollment).where(
        StudentEnrollment.class_id == class_id,
        StudentEnrollment.student_id == student_id,
    ))
    submissions = db.scalars(
        select(Submission)
        .join(Assessment, Assessment.id == Submission.assessment_id)
        .where(Submission.student_id == student_id, Assessment.class_id == class_id)
        .order_by(Submission.submitted_at.asc(), Submission.id.asc())
    ).all()
    timeline = []
    for s in submissions:
        assessment = db.get(Assessment, s.assessment_id)
        timeline.append({
            "submission_id": s.id,
            "assessment_id": s.assessment_id,
            "assessment": assessment.title if assessment else f"Assessment {s.assessment_id}",
            "attempt_no": s.attempt_no,
            "raw_score": s.raw_score,
            "max_score": assessment.max_score if assessment else None,
            "percentage": s.percentage,
            "submitted_at": s.submitted_at.isoformat(),
        })
    latest = _latest_submission_per_assessment(db, student_id, class_id)
    latest_scores = [s.percentage for s in latest]
    misconceptions = Counter([s.misconception for s in latest if s.misconception])
    tasks = db.scalars(select(InterventionTask).where(
        InterventionTask.student_id == student_id,
        InterventionTask.class_id == class_id,
    )).all()
    risk = student_academic_risk(db, student_id, class_id, enrollment)
    return {
        "student_id": student_id,
        "class_id": class_id,
        "progress": enrollment.progress if enrollment else 0,
        "score_timeline": timeline,
        "latest_assessment_scores": [s.percentage for s in latest],
        "average_score": _round(mean(latest_scores)) if latest_scores else None,
        "risk": risk,
        "misconceptions": [{"name": n, "count": c} for n, c in misconceptions.most_common()],
        "interventions": {
            "open": sum(1 for t in tasks if t.status not in {"completed", "dismissed"}),
            "completed": sum(1 for t in tasks if t.status == "completed"),
            "outcome_review": sum(1 for t in tasks if t.status == "outcome_review"),
        },
    }


def assessment_analytics(db: Session, class_id: int) -> list[dict]:
    assessments = db.scalars(select(Assessment).where(Assessment.class_id == class_id).order_by(Assessment.created_at.desc())).all()
    result = []
    for assessment in assessments:
        items = db.scalars(select(Submission).where(Submission.assessment_id == assessment.id)).all()
        latest_by_student: dict[str, Submission] = {}
        for s in items:
            current = latest_by_student.get(s.student_id)
            if current is None or s.attempt_no >= current.attempt_no:
                latest_by_student[s.student_id] = s
        latest = list(latest_by_student.values())
        scores = [s.percentage for s in latest]
        ai_scores = [s.ai_score for s in latest if s.ai_score is not None]
        overrides = [s for s in latest if s.teacher_overridden]
        misconceptions = [s.misconception for s in latest if s.misconception]
        result.append({
            "assessment_id": assessment.id,
            "assessment": assessment.title,
            "status": assessment.status,
            "max_score": assessment.max_score,
            "attempt_limit": assessment.attempt_limit,
            "due_at": assessment.due_at.isoformat() if assessment.due_at else None,
            "students_submitted": len(latest),
            "total_attempts": len(items),
            "average_final": _round(mean(scores)) if scores else None,
            "average_ai": _round(mean(ai_scores)) if ai_scores else None,
            "override_count": len(overrides),
            "override_rate": _round((len(overrides) / len(latest)) * 100) if latest else 0,
            "misconception_count": len(misconceptions),
            "top_misconception": Counter(misconceptions).most_common(1)[0][0] if misconceptions else None,
        })
    return result


def dashboard_snapshot(db: Session, teacher_id: str, class_id: int, risk_threshold: int = 40) -> dict:
    from ..models import TeacherUser
    enrollments = db.scalars(select(StudentEnrollment).where(
        StudentEnrollment.class_id == class_id,
        StudentEnrollment.enrollment_status == "active",
    )).all()
    risk_students = []
    for e in enrollments:
        risk = student_academic_risk(db, e.student_id, class_id, e)
        risk_students.append({
            "student_id": e.student_id,
            "name": e.student_name,
            "progress": e.progress,
            "status": e.status,
            "risk": risk,
        })
    risk_students.sort(key=lambda x: x["risk"]["score"], reverse=True)

    latest_scores = []
    for e in enrollments:
        latest_scores.extend([s.percentage for s in _latest_submission_per_assessment(db, e.student_id, class_id)])
    tasks = db.scalars(select(InterventionTask).where(
        InterventionTask.teacher_id == teacher_id,
        InterventionTask.class_id == class_id,
    )).all()
    open_tasks = [t for t in tasks if t.status not in {"completed", "dismissed"}]
    overdue = [t for t in open_tasks if t.due_at and t.due_at < datetime.utcnow()]

    return {
        "class_id": class_id,
        "metrics": {
            "students": len(enrollments),
            "average_progress": _round(mean([e.progress for e in enrollments])) if enrollments else 0,
            "average_final_score": _round(mean(latest_scores)) if latest_scores else None,
            "students_over_threshold": sum(1 for x in risk_students if x["risk"]["score"] >= risk_threshold),
            "open_interventions": len(open_tasks),
            "overdue_interventions": len(overdue),
        },
        "status_distribution": dict(Counter(e.status for e in enrollments)),
        "risk_students": risk_students,
        "assessment_health": assessment_analytics(db, class_id),
    }


def intervention_suggestions(db: Session, teacher_id: str, class_id: int) -> list[dict]:
    enrollments = db.scalars(select(StudentEnrollment).where(
        StudentEnrollment.class_id == class_id,
        StudentEnrollment.enrollment_status == "active",
    )).all()
    suggestions = []
    for e in enrollments:
        risk = student_academic_risk(db, e.student_id, class_id, e)
        if risk["score"] < 25:
            continue
        repeated = risk["repeated_misconceptions"]
        if repeated:
            top = repeated[0]["name"]
            title = f"Targeted review: {top}"
            action_type = "targeted_review"
            details = f"Review the repeated misconception '{top}', then reassess with one focused question."
        elif e.progress < 65:
            title = "Progress check-in"
            action_type = "progress_check"
            details = "Identify the current blocking lesson and agree on one concrete next step."
        else:
            title = "Performance follow-up"
            action_type = "follow_up"
            details = "Review the recent score trend and define the next learning action."
        suggestions.append({
            "student_id": e.student_id,
            "student": e.student_name,
            "class_id": class_id,
            "risk": risk,
            "title": title,
            "action_type": action_type,
            "priority": "critical" if risk["level"] == "critical" else "high" if risk["level"] == "high" else "medium",
            "details": details,
        })
    return sorted(suggestions, key=lambda x: x["risk"]["score"], reverse=True)
