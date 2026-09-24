"""In-memory data store with JSON persistence.

This acts as the Digital Twin database. In a production system this
would be a real database (or LangGraph checkpointer), but for this
project we persist to JSON files so nothing is lost on restart.
"""
import json
import os
import threading
import time
from pathlib import Path
from datetime import datetime

from fastapi import HTTPException

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# RLock: ensure()/update() call load() and save() nested under the same lock.
_lock = threading.RLock()

DEFAULT_VARK = {
    "visual": 50.0,
    "auditory": 50.0,
    "reading": 50.0,
    "kinesthetic": 50.0,
}


AGE_TO_GRADE = {
    6: "1st", 7: "2nd", 8: "3rd", 9: "4th", 10: "5th", 11: "6th",
    12: "7th", 13: "8th", 14: "9th", 15: "10th", 16: "11th", 17: "12th",
}

GRADE_TO_AGE = {g: a for a, g in AGE_TO_GRADE.items()}

GRADE_LABELS = {
    "1st": "1st Grade", "2nd": "2nd Grade", "3rd": "3rd Grade",
    "4th": "4th Grade", "5th": "5th Grade", "6th": "6th Grade",
    "7th": "7th Grade", "8th": "8th Grade", "9th": "9th Grade",
    "10th": "10th Grade", "11th": "11th Grade", "12th": "12th Grade",
}


def age_to_grade(age):
    return AGE_TO_GRADE.get(int(age), "5th")


def default_twin():
    return {
        "user_id": None,
        "role": "student",
        "email": None,
        "name": None,
        "age": 10,
        "grade": "5th",
        "sen_flags": [],
        "sen_scores": {},
        "sen_profile": "general",
        "dyslexic": False,
        "vark": dict(DEFAULT_VARK),
        "xp": 0,
        "badge": "Bronze",
        "misconception_bins": {},
        "assessment_history": [],
        "exam_history": [],
        "daily_plan": {},
        "reviews": {},  # question_id -> next_review_timestamp
        "emotion": None,
        "session_start": None,
        "last_break_reminder": None,
        "continuity_minutes": 0,
        "surprise_triggered": False,
        "affirmations": [],
        "topics": {},  # topic -> {score, attempts, progress}
        "custom_topics": [],
        "interests": [],
        "enrolled_classes": [],
    }


def _path(user_id):
    safe = str(user_id).replace("/", "_").replace("\\", "_")
    return DATA_DIR / f"user_{safe}.json"


def load(user_id):
    reject_teacher_id(user_id)
    p = _path(user_id)
    if not p.exists():
        return None
    try:
        # Hold the lock while the file is open so os.replace() in save()
        # cannot race an open handle (PermissionError on Windows).
        with _lock:
            with open(p, "r", encoding="utf-8") as f:
                return json.load(f)
    except (OSError, json.JSONDecodeError):
        # Empty or truncated file (e.g. a hard kill mid-write) — treat as a
        # fresh profile instead of 500-ing every request for this user.
        try:
            p.rename(p.with_suffix(p.suffix + f".corrupt-{int(datetime.utcnow().timestamp())}"))
        except OSError:
            pass
        return None


def is_teacher_id(user_id) -> bool:
    return str(user_id or "").startswith("teacher-")


def reject_teacher_id(user_id):
    """Teacher accounts live in SQL; they must never touch the student twin store."""
    if is_teacher_id(user_id):
        raise HTTPException(
            status_code=403,
            detail="Teacher accounts do not use the student store",
        )


def ensure(user_id, defaults=None):
    reject_teacher_id(user_id)
    with _lock:
        twin = load(user_id)
        if twin is None:
            twin = defaults or default_twin()
            twin["user_id"] = user_id
            save(user_id, twin)
            return twin
        # Backfill missing keys so crashes/schema-changes don't break us
        base = default_twin()
        base["user_id"] = user_id
        changed = False
        for k, v in base.items():
            if k not in twin:
                twin[k] = v
                changed = True
        # Only rewrite when something was actually added — GET /profile
        # used to rewrite the file on every request, racing open readers.
        if changed:
            save(user_id, twin)
        return twin


def save(user_id, twin):
    reject_teacher_id(user_id)
    struct = json.dumps(twin, ensure_ascii=False, indent=2)
    target = _path(user_id)
    # Unique temp name per process/thread so parallel workers never share
    # one .tmp path (a leftover lock on a fixed .tmp also caused WinError 5).
    tmp = target.with_name(
        f"{target.name}.{os.getpid()}.{threading.get_ident()}.tmp"
    )
    last_err = None
    with _lock:
        for attempt in range(5):
            try:
                with open(tmp, "w", encoding="utf-8") as f:
                    f.write(struct)
                    f.flush()
                    os.fsync(f.fileno())
                os.replace(tmp, target)
                return
            except PermissionError as e:
                # Windows: destination briefly locked by a reader, antivirus,
                # or cloud-sync. Back off and retry before failing the request.
                last_err = e
                try:
                    if tmp.exists():
                        tmp.unlink()
                except OSError:
                    pass
                time.sleep(0.05 * (attempt + 1))
            except OSError as e:
                last_err = e
                try:
                    if tmp.exists():
                        tmp.unlink()
                except OSError:
                    pass
                time.sleep(0.05 * (attempt + 1))
        # Last resort after retries: overwrite in place (still under lock).
        with open(target, "w", encoding="utf-8") as f:
            f.write(struct)
            f.flush()
            os.fsync(f.fileno())
        if last_err is not None:
            return


def update(user_id, patch):
    reject_teacher_id(user_id)
    with _lock:
        twin = ensure(user_id)
        twin.update(patch)
        save(user_id, twin)
        return twin


def find_by_email(email):
    """Return the stored profile for an email address, if it exists.

    The project deliberately uses JSON persistence for its demo database, so
    this small lookup keeps authentication and profile data in one place.
    """
    needle = (email or "").strip().lower()
    if not needle:
        return None
    with _lock:
        for path in DATA_DIR.glob("user_*.json"):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    record = json.load(f)
                # Ignore polluted teacher twins left by the old fall-through;
                # teachers authenticate against SQL, not this store.
                if is_teacher_id(record.get("user_id")):
                    continue
                if (record.get("email") or "").strip().lower() == needle:
                    return record
            except (OSError, json.JSONDecodeError):
                continue
    return None


def now_ts():
    return datetime.utcnow().isoformat() + "Z"


def next_review(interval_days):
    from datetime import timedelta
    return (datetime.utcnow() + timedelta(days=interval_days)).isoformat() + "Z"
