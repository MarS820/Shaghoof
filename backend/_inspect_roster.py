import sqlite3, json, glob, os

db = sqlite3.connect("shaghoof_teacher.db")
db.row_factory = sqlite3.Row
print("=== classrooms ===")
for r in db.execute("SELECT * FROM classrooms ORDER BY id"):
    print(dict(r))
print("=== class 11 enrollments ===")
print(db.execute("SELECT COUNT(*) FROM student_enrollments WHERE class_id=11").fetchone()[0])
print("=== distinct 5th students via join ===")
rows = db.execute(
    "SELECT DISTINCT e.student_id, e.student_name, e.student_email "
    "FROM student_enrollments e JOIN classrooms c ON c.id = e.class_id "
    "WHERE c.grade = ? AND e.enrollment_status = 'active'",
    ("5th",),
).fetchall()
for r in rows:
    print(dict(r))
print("count", len(rows))
print("=== all students with grade 5th twins ===")
for p in sorted(glob.glob("data/user_*.json")):
    with open(p, encoding="utf-8") as f:
        t = json.load(f)
    g = str(t.get("grade", ""))
    if g.lower().startswith("5") or t.get("age") in (10, 11):
        print(
            os.path.basename(p),
            "grade=", t.get("grade"),
            "age=", t.get("age"),
            "role=", t.get("role"),
            "enrolled=", t.get("enrolled_classes"),
            "school=", t.get("school_user"),
        )
db.close()
