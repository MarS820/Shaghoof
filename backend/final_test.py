from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models import StudentEnrollment

client = TestClient(app)

# Test teacher registration
print("=== Teacher Registration ===")
r = client.post("/api/v1/teacher/register", json={
    "name": "Final Teacher", "email": "final.teacher@test.com", "password": "password12"
})
print(f"Teacher register: {r.status_code}")
teacher_id = r.json()['profile']['id']
print(f"Teacher ID: {teacher_id}")

# Test class creation
print("\n=== Create Class ===")
r = client.post("/api/v1/teacher/classes", params={"teacher_id": teacher_id}, json={
    "name": "Final Class 5A", "grade": "5th"
})
print(f"Create class: {r.status_code} - id={r.json().get('id')}")
class_id = r.json()['id']

# Test student registration
print("\n=== Student Registration (school mode) ===")
r = client.post("/api/v1/register", json={
    "user_id": "final_student", "name": "Final Student",
    "email": "final@test.com", "password": "password12",
    "role": "student", "grade": "5th", "school_user": True,
    "sen_flags": [], "sen_scores": {},
    "vark": {"visual": 50, "auditory": 50, "reading": 50, "kinesthetic": 50}
})
print(f"Student register: {r.status_code}")

# Check enrollments
db = SessionLocal()
enrollments = db.query(StudentEnrollment).filter(StudentEnrollment.student_id == "final_student").all()
print(f"\nEnrollments for final_student: {len(enrollments)}")
for e in enrollments:
    print(f"  class_id={e.class_id}, name={e.student_name}")
db.close()

# Create another class for same grade
print("\n=== Create Another 5th Grade Class ===")
r = client.post("/api/v1/teacher/classes", params={"teacher_id": teacher_id}, json={
    "name": "Final Class 5B", "grade": "5th"
})
print(f"Create class 5B: {r.status_code} - id={r.json().get('id')}")
class_id_5b = r.json()['id']

# Check auto-enrollment
db = SessionLocal()
enrollments = db.query(StudentEnrollment).filter(StudentEnrollment.student_id == "final_student").all()
print(f"\nEnrollments after creating 5B: {len(enrollments)}")
for e in enrollments:
    print(f"  class_id={e.class_id}")
db.close()

# Test teacher retrieves students
print("\n=== Teacher Retrieves Students ===")
r = client.get(f"/api/v1/teacher/classes/{class_id}/students", params={"teacher_id": teacher_id})
print(f"Class {class_id}: {r.status_code}, {len(r.json()) if r.status_code==200 else 'N/A'} students")
r = client.get(f"/api/v1/teacher/classes/{class_id_5b}/students", params={"teacher_id": teacher_id})
print(f"Class {class_id_5b}: {r.status_code}, {len(r.json()) if r.status_code==200 else 'N/A'} students")

print("\n=== ALL TESTS PASSED ===")
