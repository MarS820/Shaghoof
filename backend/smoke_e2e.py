"""End-to-end smoke: teacher → class → student login → XP sync → quiz types → TTS."""
import json
import sys
import time
import urllib.request
import urllib.error
import uuid

BASE = "http://localhost:8080"


def req(method, path, body=None, params=None, timeout=90):
    url = BASE + path
    if params:
        from urllib.parse import urlencode
        url += "?" + urlencode(params)
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    if data:
        r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            raw = resp.read()
            ct = resp.headers.get("Content-Type", "")
            if "json" in ct:
                return resp.status, json.loads(raw)
            return resp.status, raw
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw.decode(errors="replace")


def main():
    ok = True

    # 1) health
    st, body = req("GET", "/api/v1/health")
    print(f"HEALTH {st} {body}")
    ok &= st == 200

    # 2) register teacher
    email = f"t.{uuid.uuid4().hex[:8]}@test.local"
    st, t = req("POST", "/api/v1/teacher/register", {"name": "Smoke T", "email": email, "password": "Passw0rd!", "grade": "5th"})
    print(f"TEACHER REGISTER {st} {t.get('profile', {}).get('id') if isinstance(t, dict) else t}")
    ok &= st in (200, 201)
    tid = t["profile"]["id"]

    # 3) class
    st, c = req("POST", "/api/v1/teacher/classes", {"name": "Smoke", "grade": "5th"}, params={"teacher_id": tid})
    print(f"CLASS {st} {c}")
    ok &= st in (200, 201)
    cid = c["id"] if isinstance(c, dict) else c.get("id")

    # 4) student with password
    s_email = f"s.{uuid.uuid4().hex[:8]}@test.local"
    st, s = req("POST", f"/api/v1/teacher/classes/{cid}/students", {"name": "Smoke S", "email": s_email, "password": "Student123!"}, params={"teacher_id": tid})
    print(f"STUDENT CREATE {st} {s}")
    ok &= st in (200, 201)
    sid = s["student_id"]

    # 5) student login
    st, lp = req("POST", "/api/v1/auth/login", {"email": s_email, "password": "Student123!"})
    print(f"STUDENT LOGIN {st} role={lp.get('profile', {}).get('role') if isinstance(lp, dict) else lp}")
    ok &= st == 200 and isinstance(lp, dict) and lp.get("profile", {}).get("role") == "student"

    # 6) enrolled classes
    st, ec = req("GET", "/api/v1/student/enrolled-classes", params={"user_id": sid})
    names = [x.get("name") for x in ec] if isinstance(ec, list) else ec
    print(f"ENROLLED {st} {names}")
    ok &= st == 200 and isinstance(ec, list) and len(ec) >= 1

    # 7) assess session → XP sync
    st, _ = req("POST", "/api/v1/assess/session", {"user_id": sid, "topic": "Photosynthesis", "total_questions": 5, "correct_count": 4, "score": 80, "growth_score": 0, "xp_earned": 20, "mode": "quiz"})
    print(f"ASSESS SESSION {st}")
    ok &= st == 200
    time.sleep(0.3)

    # 8) teacher student profile shows XP + exam history
    st, sp = req("GET", f"/api/v1/teacher/classes/{cid}/student/{sid}", params={"teacher_id": tid})
    exams = sp.get("exam_history") if isinstance(sp, dict) else None
    print(f"TEACHER PROFILE {st} xp={sp.get('xp') if isinstance(sp, dict) else '?'} badge={sp.get('badge') if isinstance(sp, dict) else '?'} exams={len(exams) if exams else 0}")
    ok &= st == 200 and isinstance(sp, dict) and int(sp.get("xp") or 0) >= 20 and exams and len(exams) >= 1

    # 9) quiz multi-type
    st, q = req("POST", "/quiz/generate", {
        "topic": "Solar System", "n": 4, "difficulty": "Easy", "subject": "Science",
        "user_id": sid, "ground_in_lessons": True,
        "question_types": ["mcq", "true_false", "fill_blank", "short_answer"],
    }, timeout=120)
    if st == 200 and isinstance(q, dict):
        types = [x.get("type") for x in q.get("questions", [])]
        print(f"QUIZ {st} types={types} count={len(types)}")
        ok &= len(types) >= 1
    else:
        print(f"QUIZ {st} {q}")
        # offline fallback should still return questions even without AI/lessons
        ok &= False

    # 10) TTS engines
    for engine in ("azure", "elevenlabs", "google"):
        st, audio = req("POST", "/championship/podcast/tts", {
            "text": "Hello from Shaghoof smoke test", "speaker": "host1",
            "language": "en", "dialect": False, "speed": 1.0, "engine": engine,
        }, timeout=60)
        size = len(audio) if isinstance(audio, (bytes, bytearray)) else 0
        print(f"TTS {engine} {st} bytes={size}")
        ok &= st == 200 and size > 500

    print("RESULT:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
