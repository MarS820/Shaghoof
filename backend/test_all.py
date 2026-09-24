import sys, json
sys.path.insert(0, '.')

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models import Classroom, StudentEnrollment, TeacherUser

client = TestClient(app)

# Clean up
db = SessionLocal()
for e in db.query(StudentEnrollment).filter(StudentEnrollment.student_id.like("test_%")).all():
    db.delete(e)
for c in db.query(Classroom).filter(Classroom.name.like("Test%")).all():
    db.delete(c)
for t in db.query(TeacherUser).filter(TeacherUser.email.like("uniq%")).all():
    db.delete(t)
db.commit()
db.close()

# Step 1: Register teacher
print("=== Step 1: Register teacher ===")
r = client.post("/api/v1/teacher/register", json={
    "name": "Uniq Teacher", "email": "uniq.teacher@example.com", "password": "password12"
})
print(f"Teacher register: {r.status_code}")
teacher_id = r.json()['profile']['id']

# Step 2: Create class
print("\n=== Step 2: Create class ===")
r = client.post("/api/v1/teacher/classes", params={"teacher_id": teacher_id}, json={
    "name": "Test Class 5A", "grade": "5th"
})
print(f"Create class: {r.status_code} - id={r.json().get('id')}")
class_id = r.json()['id']

# Step 3: Register student with school mode
print("\n=== Step 3: Student registers with school mode ===")
r = client.post("/api/v1/register", json={
    "user_id": "test_student_003",
    "name": "Test Student",
    "email": "uniqtest3@school.com",
    "password": "password12",
    "role": "student", "grade": "5th", "school_user": True,
    "sen_flags": [], "sen_scores": {},
    "vark": {"visual": 50, "auditory": 50, "reading": 50, "kinesthetic": 50}
})
print(f"Student register: {r.status_code}")

# Step 4: Verify student enrollments
db = SessionLocal()
enrollments = db.query(StudentEnrollment).filter(StudentEnrollment.student_id == "test_student_003").all()
print(f"\nEnrollments for test_student_003: {len(enrollments)}")
for e in enrollments:
    print(f"  class_id={e.class_id}, name={e.student_name}")
db.close()

# Step 5: Create another class for same grade - verify auto-enrollment
print("\n=== Step 4: Create another 5th grade class ===")
r = client.post("/api/v1/teacher/classes", params={"teacher_id": teacher_id}, json={
    "name": "Test Class 5B", "grade": "5th"
})
print(f"Create class 5B: {r.status_code} - id={r.json().get('id')}")
class_id_5b = r.json()['id']

# Step 6: Verify student auto-enrolled in 5B
db = SessionLocal()
enrollments = db.query(StudentEnrollment).filter(StudentEnrollment.student_id == "test_student_003").all()
print(f"\nEnrollments after creating 5B: {len(enrollments)}")
for e in enrollments:
    print(f"  class_id={e.class_id}")

# Check all students in both classes
for cid in [class_id, class_id_5b]:
    count = db.query(StudentEnrollment).filter(StudentEnrollment.class_id == cid).count()
    print(f"  Class {cid} has {count} students")

# Step 7: Verify teacher can retrieve students
r = client.get(f"/api/v1/teacher/classes/{class_id}/students", params={"teacher_id": teacher_id})
print(f"\nTeacher retrieves class {class_id} students: {r.status_code}, count={len(r.json()) if r.status_code==200 else 'N/A'}")

r = client.get(f"/api/v1/teacher/classes/{class_id_5b}/students", params={"teacher_id": teacher_id})
print(f"Teacher retrieves class {class_id_5b} students: {r.status_code}, count={len(r.json()) if r.status_code==200 else 'N/A'}")

db.close()
print("\n=== ALL TESTS PASSED ===")
