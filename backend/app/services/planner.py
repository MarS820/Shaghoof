"""Personalized daily study plans built from the learner's real twin data."""
from __future__ import annotations

from datetime import date


# Default style assignment for known subjects (used only as fallback hints).
_STYLE_HINTS = {
    "math": "kinesthetic", "mathematics": "kinesthetic",
    "science": "visual",
    "reading": "reading",
    "art": "auditory", "art & creativity": "auditory",
    "coding": "visual", "programming": "visual",
    "language": "reading", "languages": "reading",
}

# Default icons for known subjects.
_ICON_HINTS = {
    "math": "➕", "mathematics": "➕",
    "science": "🔬",
    "reading": "📚",
    "art": "🎨", "art & creativity": "🎨",
    "coding": "💻", "programming": "💻",
    "language": "🌐", "languages": "🌐",
}


def topic_progress(entry: dict | None) -> int:
    """Progress is evidence based: demonstrated mastery plus sustained practice."""
    if not entry or not entry.get("attempts"):
        return 0
    scores = entry.get("scores", [])
    average = sum(scores) / len(scores) if scores else 0
    consistency = min(100, (entry.get("attempts", 0) / 8) * 100)
    return round(min(100, average * 0.65 + consistency * 0.35))


def course_snapshot(twin: dict) -> list[dict]:
    """Build course list ONLY from the user's own subjects and interests.

    No hardcoded default subjects are injected.  If the user has not created
    any subjects or interests yet, the list will be empty — the frontend
    should show an onboarding prompt in that case.
    """
    topics = twin.get("topics", {})
    courses = []

    # 1) User-defined subjects (from Settings / onboarding)
    user_subjects = twin.get("subjects") or []
    for subj in user_subjects:
        name = (subj.get("name") or "").strip() if isinstance(subj, dict) else str(subj).strip()
        if not name:
            continue
        key = name.lower()
        entry = topics.get(name)
        style = _STYLE_HINTS.get(key, "visual")
        icon = _ICON_HINTS.get(key, "📘")
        courses.append({
            "key": key,
            "title": name,
            "icon": icon,
            "style": style,
            "progress": topic_progress(entry),
            "attempts": (entry or {}).get("attempts", 0),
        })

    # 2) Custom topics / interests (added via Settings or tutor chat)
    interests = twin.get("interests") or twin.get("custom_topics", [])
    seen_keys = {c["key"] for c in courses}
    for topic in interests:
        name = str(topic).strip()
        if not name:
            continue
        key = name.lower()
        if key in seen_keys:
            continue
        seen_keys.add(key)
        entry = topics.get(name)
        style = _STYLE_HINTS.get(key, "reading")
        icon = _ICON_HINTS.get(key, "📘")
        courses.append({
            "key": key,
            "title": name,
            "icon": icon,
            "style": style,
            "progress": topic_progress(entry),
            "attempts": (entry or {}).get("attempts", 0),
        })

    return courses


def build_daily_plan(twin: dict) -> dict:
    courses = course_snapshot(twin)
    age = twin.get("age", 10)
    mood = (twin.get("emotion") or {}).get("mood", "neutral")
    vark = twin.get("vark", {})
    dominant = max(vark, key=vark.get) if vark else "visual"
    weakest = min(vark, key=vark.get) if vark else "reading"
    flags = {str(flag).lower() for flag in twin.get("sen_flags", [])}

    # Only generate tasks if the user actually has courses
    task_count = 0
    if courses:
        task_count = 2 if age <= 9 or mood in {"tired", "frustrated"} else 3
    minutes = 8 if age <= 9 else 12 if age <= 12 else 18
    ranked = sorted(courses, key=lambda course: (course["progress"] > 0, course["progress"], -course["attempts"]))
    targets = ranked[:task_count]
    task_types = ["focus", "practice", "stretch"]
    tasks = []
    for index, course in enumerate(targets):
        mode = task_types[index]
        if mode == "focus":
            title = f"Build confidence in {course['title']}"
            detail = f"A {minutes}-minute {dominant} activity tailored to your strongest learning style."
        elif mode == "stretch":
            title = f"Stretch your {weakest} pathway"
            detail = f"Try one gentle challenge in {course['title']} and explain your thinking."
        else:
            title = f"Practice {course['title']}"
            detail = f"Answer a short set, then use the feedback to improve one idea."
        tasks.append({
            "id": f"{date.today().isoformat()}-{index}-{course['key']}",
            "kind": mode,
            "topic": course["key"],
            "title": title,
            "detail": detail,
            "minutes": minutes if mode != "stretch" else max(6, minutes - 2),
            "completed": False,
        })

    accommodations = []
    if "deaf" in flags:
        accommodations.append("Use visual instructions and verified sign-video clips when available.")
    if "blind" in flags:
        accommodations.append("Use audio-first prompts and the slower voice reader.")
    if flags & {"cognitive", "dyslexia", "dyslexic", "esl"}:
        accommodations.append("Text-support overlay: shorter lines, glossary, and speech on every prompt.")
    if flags & {"adhd", "semh", "focus", "emotional"}:
        accommodations.append("Focus overlay: 2-minute micro-quests, one action at a time, then a pause.")
    if flags & {"asd", "autism", "slcn", "speech", "language"}:
        accommodations.append("Structure overlay: same sequence each time, concrete language, limited sensory load.")
    if mood in {"tired", "frustrated"}:
        accommodations.append("Today is a lighter plan: small wins first, then take a break.")

    overall = round(sum(c["progress"] for c in courses) / len(courses)) if courses else 0
    return {
        "date": date.today().isoformat(),
        "age_band": "starter" if age <= 9 else "builder" if age <= 12 else "explorer",
        "mood": mood,
        "dominant_style": dominant,
        "weakest_style": weakest,
        "courses": courses,
        "overall_progress": overall,
        "tasks": tasks,
        "accommodations": accommodations,
    }
