"""One-off repair: enroll existing 5th-grade students into class 11 (class stars)
and mirror enrolled_classes into their JSON twins."""
import json
import sqlite3
from pathlib import Path

CLASS_ID = 11
GRADE = "5th"
DB = Path(__file__).resolve().parent / "shaghoof_teacher.db"
DATA = Path(__file__).resolve().parent / "data"

db = sqlite3.connect(DB)
db.row_factory = sqlite3.Row

# Unique students who sit in any active same-grade class (by student_id only —
# the same student can appear under multiple historical names).
rows = db.execute(
    """
    SELECT e.student_id,
           MIN(e.student_name) AS student_name,
           MIN(e.student_email) AS student_email
    FROM student_enrollments e
    JOIN classrooms c ON c.id = e.class_id
    WHERE c.grade = ? AND e.enrollment_status = 'active'
    GROUP BY e.student_id
    """,
    (GRADE,),
).fetchall()

existing = {
    r[0]
    for r in db.execute(
        "SELECT student_id FROM student_enrollments WHERE class_id = ?",
        (CLASS_ID,),
    )
}

inserted = []
for r in rows:
    sid = r["student_id"]
    if sid in existing or sid in inserted:
        continue
    db.execute(
        """
        INSERT INTO student_enrollments
            (class_id, student_id, student_name, student_email,
             progress, status, xp, badge, enrollment_status, enrolled_at)
        VALUES (?, ?, ?, ?, 0, 'green', 0, 'Bronze', 'active', datetime('now'))
        """,
        (CLASS_ID, sid, r["student_name"], r["student_email"]),
    )
    inserted.append(sid)

db.commit()

# Mirror into twins.
safe = lambda s: str(s).replace("/", "_").replace("\\", "_")
updated_twins = []
for sid in inserted:
    path = DATA / f"user_{safe(sid)}.json"
    if not path.exists():
        continue
    with open(path, encoding="utf-8") as f:
        twin = json.load(f)
    enrolled = set(twin.get("enrolled_classes") or [])
    if CLASS_ID not in enrolled:
        enrolled.add(CLASS_ID)
        twin["enrolled_classes"] = sorted(enrolled)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(twin, f, ensure_ascii=False, indent=2)
        updated_twins.append(sid)

count = db.execute(
    "SELECT COUNT(*) FROM student_enrollments WHERE class_id = ?", (CLASS_ID,)
).fetchone()[0]
db.close()
print(f"inserted={len(inserted)} twins_updated={len(updated_twins)} class_{CLASS_ID}_count={count}")
