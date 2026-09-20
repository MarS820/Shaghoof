from __future__ import annotations
from collections import Counter
import pandas as pd
import numpy as np


def weak_topics(events: pd.DataFrame) -> list[str]:
    if events.empty:
        return []
    quiz = events[(events["event_type"] == "quiz_submitted") & events["topic"].notna()].copy()
    if quiz.empty:
        return []
    quiz["rate"] = quiz["score"] / quiz["total"].replace(0, 1)
    grouped = quiz.groupby("topic")["rate"].mean().sort_values(ascending=True)
    counts = quiz["topic"].value_counts()
    result = []
    for topic in grouped[grouped < 0.75].index[:6]:
        if grouped[topic] < 0.6 and counts.get(topic, 0) >= 2:
            result.insert(0, topic)
        else:
            result.append(topic)
    return result


def strong_topics(events: pd.DataFrame) -> list[str]:
    if events.empty:
        return []
    quiz = events[(events["event_type"] == "quiz_submitted") & events["topic"].notna()].copy()
    if quiz.empty:
        return []
    quiz["rate"] = quiz["score"] / quiz["total"].replace(0, 1)
    counts = quiz["topic"].value_counts()
    grouped = quiz.groupby("topic")["rate"].mean().sort_values(ascending=False)
    result = []
    for topic in grouped[grouped >= 0.8].index[:6]:
        boost = min(counts.get(topic, 0) * 0.05, 0.15)
        if grouped[topic] + boost >= 0.85:
            result.insert(0, topic)
        else:
            result.append(topic)
    return result[:4]


def learning_pace(events: pd.DataFrame) -> dict:
    if events.empty or "timestamp" not in events.columns:
        return {"pace": "steady", "consistency": "unknown"}
    events = events.copy()
    events["date"] = pd.to_datetime(events["timestamp"]).dt.date
    daily = events.groupby("date").size()
    if len(daily) < 2:
        return {"pace": "starting", "consistency": "new_learner"}
    mean_a, std_a = daily.mean(), daily.std()
    cv = std_a / mean_a if mean_a > 0 else 1.0
    consistency = "highly_consistent" if cv < 0.3 else "moderately_consistent" if cv < 0.6 else "inconsistent"
    pace = "steady" if cv < 0.3 else "irregular" if cv < 0.6 else "sporadic"
    recent = daily.tail(3).mean() if len(daily) >= 3 else daily.mean()
    if recent > mean_a * 1.2:
        pace = "accelerating"
    elif recent < mean_a * 0.8:
        pace = "slowing"
    return {"pace": pace, "consistency": consistency}


def topic_engagement(events: pd.DataFrame) -> dict:
    if events.empty:
        return {"most_engaged": [], "least_engaged": [], "total_topics": 0}
    activity = events[events["topic"].notna()].groupby("topic").size().sort_values(ascending=False)
    return {"most_engaged": activity.head(3).index.tolist(),
            "least_engaged": activity.tail(3).index.tolist(),
            "total_topics": len(activity)}


def recommendation_plan(events: pd.DataFrame) -> list[str]:
    weak = weak_topics(events)
    strong = strong_topics(events)
    counts = Counter(events["event_type"]) if not events.empty else Counter()
    engagement = topic_engagement(events)
    pace = learning_pace(events)
    plan = []
    if weak:
        plan.append(f"Priority: Start with flashcards on {weak[0]}, then take a medium quiz.")
        if len(weak) > 1:
            plan.append(f"Secondary: Review {weak[1]} with 5 practice questions.")
    else:
        plan.append("No weak topics detected. Take a diagnostic quiz to maintain your edge.")
    if strong:
        plan.append(f"Leverage strengths: You excel at {strong[0]}. Consider teaching it to deepen understanding.")
    if counts.get("pdf_question", 0) < 3:
        plan.append("Knowledge gap: Upload a lecture PDF and ask at least 3 questions.")
    if counts.get("assignment_generated", 0) < 1:
        plan.append("Active recall: Generate one assignment from your lecture notes.")
    if pace.get("pace") == "accelerating":
        plan.append("You're on a roll! Increase difficulty to stay challenged.")
    elif pace.get("pace") == "slowing":
        plan.append("Take a breather: Review your notes before the next session.")
    elif pace.get("consistency") == "inconsistent":
        plan.append("Consistency tip: Try 15 minutes daily instead of 2 hours weekly.")
    if engagement.get("most_engaged"):
        plan.append(f"Most engaged with: {', '.join(engagement['most_engaged'])}.")
    total = len(events)
    if total > 50:
        plan.append("Great progress! You're building strong learning habits.")
    elif total > 20:
        plan.append("Good momentum — you're on the right track!")
    return plan


def get_learning_insights(events: pd.DataFrame) -> dict:
    if events.empty:
        return {"weak_topics": [], "strong_topics": [], "recommendations": ["Start by uploading materials!"],
                "learning_pace": {}, "topic_engagement": {}, "metrics": {}}
    return {
        "weak_topics": weak_topics(events),
        "strong_topics": strong_topics(events),
        "recommendations": recommendation_plan(events),
        "learning_pace": learning_pace(events),
        "topic_engagement": topic_engagement(events),
        "metrics": {
            "total_events": len(events),
            "quiz_count": len(events[events["event_type"] == "quiz_submitted"]),
            "pdf_questions": len(events[events["event_type"] == "pdf_question"]),
            "assignments": len(events[events["event_type"] == "assignment_generated"]),
            "unique_topics": len(events[events["topic"].notna()]["topic"].unique()),
        },
    }
