import sys
sys.path.insert(0, '.')
from app.core.database import SessionLocal
from app.core import store
from app.models import Classroom, StudentEnrollment
from sqlalchemy import select

# Create a test student
store.save('debug_student', {'user_id': 'debug_student', 'name': 'Debug Student', 'email': 'debug@school.com', 'grade': '5th', 'enrolled_classes': []})

# Now run _auto_enroll_student logic manually
db = SessionLocal()
try:
    stmt = select(Classroom).where(Classroom.grade == '5th')
    classes = db.execute(stmt).scalars().all()
    print(f'Found {len(classes)} classrooms with grade 5th')
    for c in classes:
        print(f'  class_id={c.id}, name={c.name}')
    
    twin_rec = store.load('debug_student')
    enrolled = set(twin_rec.get('enrolled_classes', []))
    print(f'Current enrolled_classes: {enrolled}')
    
    for cls in classes:
        if cls.id in enrolled:
            print(f'  Skipping class {cls.id} (already enrolled)')
            continue
        stmt2 = select(StudentEnrollment).where(
            StudentEnrollment.class_id == cls.id,
            StudentEnrollment.student_id == 'debug_student',
            StudentEnrollment.enrollment_status == 'active',
        )
        existing = db.execute(stmt2).scalar_one_or_none()
        if existing:
            print(f'  Student already enrolled in class {cls.id}')
            continue
        enrollment = StudentEnrollment(
            class_id=cls.id, student_id='debug_student',
            student_name='Debug Student', student_email='debug@school.com',
            progress=0, status='green'
        )
        db.add(enrollment)
        enrolled.add(cls.id)
        print(f'  Added enrollment for class {cls.id}')
    
    db.commit()
    print(f'Committed. Enrolled classes: {enrolled}')
    
    # Verify
    verify = db.query(StudentEnrollment).filter(StudentEnrollment.student_id == 'debug_student').all()
    print(f'SQL enrollments: {len(verify)}')
    for e in verify:
        print(f'  class_id={e.class_id}')
    
    if enrolled - set(twin_rec.get('enrolled_classes', []) or []):
        store.update('debug_student', {'enrolled_classes': sorted(enrolled)})
        print('Updated JSON store')
except Exception as e:
    print(f'ERROR: {e}')
    import traceback
    traceback.print_exc()
    db.rollback()
finally:
    db.close()

# Verify JSON store
t = store.load('debug_student')
print(f'Final enrolled_classes: {t.get("enrolled_classes") if t else "None"}')
