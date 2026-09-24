import sys
sys.path.insert(0, '.')

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# Test teacher registration
print("=== Testing Teacher Registration ===")
r = client.post("/api/v1/teacher/register", json={
    "name": "New Teacher",
    "email": "newteacher@test.com",
    "password": "password12"
})
print(f"Status: {r.status_code}")
print(f"Response: {r.json()}")

# Test duplicate teacher registration
print("\n=== Testing Duplicate Teacher ===")
r = client.post("/api/v1/teacher/register", json={
    "name": "New Teacher",
    "email": "newteacher@test.com",
    "password": "password12"
})
print(f"Status: {r.status_code}")
print(f"Response: {r.json()}")

# Test student registration with school mode
print("\n=== Testing Student Registration (school mode) ===")
r = client.post("/api/v1/register", json={
    "user_id": "test_student_001",
    "name": "Test Student",
    "email": "teststudent@school.com",
    "password": "password12",
    "role": "student",
    "grade": "5th",
    "school_user": True,
    "sen_flags": [],
    "sen_scores": {},
    "vark": {"visual": 50, "auditory": 50, "reading": 50, "kinesthetic": 50}
})
print(f"Status: {r.status_code}")
print(f"Response: {r.json()}")

# Check student enrollments
from app.core.database import SessionLocal
from app.models import StudentEnrollment
db = SessionLocal()
enrollments = db.query(StudentEnrollment).filter(StudentEnrollment.student_id == "test_student_001").all()
print(f"\nEnrollments for test_student_001: {len(enrollments)}")
for e in enrollments:
    print(f"  class_id={e.class_id}, name={e.student_name}")
db.close()
