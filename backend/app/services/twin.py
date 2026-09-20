"""C3: Digital Twin Update.

- VARK recalculation (weighted moving average)
- XP & badge system
- Spaced Repetition Scheduler (Ebbinghaus forgetting curve)
- Brain Wheel data
"""
from datetime import datetime, timedelta

VARK_KEYS = ["visual", "auditory", "reading", "kinesthetic"]

# Ebbinghaus forgetting-curve intervals in days
EBBINGHAUS_INTERVALS = [1, 2, 4, 7, 15, 30]


def update_vark(twin, style, performance_score, weight=0.3):
    """Weighted moving average update on the active learning style."""
    vark = dict(twin.get("vark", {}))
    cur = vark.get(style, 50.0)
    new = round((1 - weight) * cur + weight * performance_score, 1)
    vark[style] = max(0.0, min(100.0, new))
    twin["vark"] = vark
    return vark


def xp_for(score, passed, growth=None):
    """XP earned per assessment."""
    base = int(score)
    if passed:
        base += 10
    if growth is not None and growth >= 60:
        base += int(growth * 0.1)
    return base


def badge_for_xp(xp):
    if xp >= 1000:
        return "Gold"
    if xp >= 500:
        return "Silver"
    return "Bronze"


def add_xp(twin, amount):
    twin["xp"] = twin.get("xp", 0) + amount
    twin["badge"] = badge_for_xp(twin["xp"])
    return twin


def next_review_interval(twin, question_id, passed):
    """Schedule next review based on forgetting curve & past reviews."""
    reviews = twin.get("reviews", {})
    past = reviews.get(question_id, 0)  # number of successful reviews
    if not passed:
        # If failed, review again soon (1 day)
        interval = 0.5
    else:
        # If strongly known, promote through Ebbinghaus intervals
        idx = min(past, len(EBBINGHAUS_INTERVALS) - 1)
        interval = EBBINGHAUS_INTERVALS[idx]
    reviews[question_id] = past + 1 if passed else max(0, past - 1)
    twin["reviews"] = reviews
    next_ts = (datetime.utcnow() + timedelta(days=interval)).isoformat() + "Z"
    twin["pending_reviews"] = twin.get("pending_reviews", {})
    twin["pending_reviews"][question_id] = next_ts
    return next_ts


def brainwheel(twin):
    vark = twin.get("vark", {})
    return {
        "labels": [k.capitalize() for k in VARK_KEYS],
        "values": [round(vark.get(k, 50.0), 1) for k in VARK_KEYS],
        "weakest": weakest(vark),
        "dominant": dominant(vark),
        "badge": twin.get("badge", "Bronze"),
    }


def weakest(vark):
    return min(vark, key=vark.get)


def dominant(vark):
    return max(vark, key=vark.get)


def apply_assessment_result(twin, result):
    """Consolidate a single assessed answer into the twin."""
    style = result.get("style", "reading")
    performance = result.get("score", 0)
    update_vark(twin, style, performance)
    add_xp(twin, result.get("xp", 0))
    # misconception bins
    key = result.get("misconception_bin")
    if key:
        bins = twin.setdefault("misconception_bins", {})
        bins[key] = bins.get(key, 0) + 1
    # retention: schedule review
    next_review_interval(
        twin, result.get("question_id", "q"), result.get("correct", False)
    )
    # history
    history = twin.setdefault("assessment_history", [])
    history.append(
        {
            "ts": datetime.utcnow().isoformat() + "Z",
            "question_id": result.get("question_id"),
            "score": result.get("score"),
            "level": result.get("conceptual_level"),
            "style": style,
            "growth": result.get("growth"),
            "topic": result.get("topic"),
        }
    )
    # keep history bounded
    if len(history) > 200:
        twin["assessment_history"] = history[-200:]
    twin["last_assessment"] = result
    return twin


def record_topic(twin, topic, score, passed):
    """Track a topic's score & progress so the dashboard shows real numbers."""
    if not topic:
        return twin
    topics = twin.setdefault("topics", {})
    entry = topics.get(topic, {"attempts": 0, "progress": 0.0, "best": 0.0, "scores": []})
    entry["attempts"] += 1
    entry["scores"].append(round(score, 1))
    if score > entry["best"]:
        entry["best"] = round(score, 1)
    # Progress reflects proof of learning, not a decorative fixed increment:
    # 65% current mastery and 35% sustained practice (up to eight attempts).
    average = sum(entry["scores"]) / len(entry["scores"])
    consistency = min(100.0, (entry["attempts"] / 8) * 100)
    entry["progress"] = round(min(100.0, average * 0.65 + consistency * 0.35), 1)
    topics[topic] = entry
    twin["topics"] = topics
    return twin
