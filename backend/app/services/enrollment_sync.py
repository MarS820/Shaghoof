"""Sync twin JSON XP/badge/progress into StudentEnrollment SQL rows."""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def sync_twin_to_enrollments(user_id: str, twin_rec: dict | None = None) -> None:
    """Copy the digital twin's XP, badge and exam-derived progress onto every
    active StudentEnrollment row for this student, so teacher roster/dashboard
    always show live data."""
    if not user_id:
        return
    try:
        from ..core import store
        from ..core.database import SessionLocal
        from ..models import StudentEnrollment

        if twin_rec is None:
            twin_rec = store.load(user_id) or store.ensure(user_id)

        xp = int(twin_rec.get("xp", 0) or 0)
        badge = twin_rec.get("badge") or "Bronze"
        # Progress heuristic: best topic score average, capped 0-100.
        topics = twin_rec.get("topics", {}) or {}
        scores = [
            float(t.get("best", t.get("progress", 0)) or 0)
            for t in topics.values()
            if isinstance(t, dict)
        ]
        progress = round(sum(scores) / len(scores), 1) if scores else float(twin_rec.get("progress", 0) or 0)
        progress = max(0.0, min(100.0, progress))

        db = SessionLocal()
        try:
            rows = (
                db.query(StudentEnrollment)
                .filter(
                    StudentEnrollment.student_id == user_id,
                    StudentEnrollment.enrollment_status == "active",
                )
                .all()
            )
            changed = False
            for row in rows:
                if row.xp != xp:
                    row.xp = xp
                    changed = True
                if row.badge != badge:
                    row.badge = badge
                    changed = True
                if abs(float(row.progress or 0) - progress) > 0.05:
                    row.progress = progress
                    changed = True
            if changed:
                db.commit()
        finally:
            db.close()
    except Exception:
        logger.exception("sync_twin_to_enrollments failed for %s", user_id)
