from __future__ import annotations
import json
import os
from datetime import datetime
from typing import Any

STORAGE_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'storage', 'events')
os.makedirs(STORAGE_DIR, exist_ok=True)


def add_event(
    user_id: str,
    event_type: str,
    topic: str = "",
    score: float = 0,
    total: float = 0,
    difficulty: str = "",
    payload: dict[str, Any] | None = None,
) -> None:
    path = os.path.join(STORAGE_DIR, f'{user_id}.json')
    events = []
    if os.path.exists(path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                events = json.load(f)
        except Exception:
            events = []
    events.append({
        'event_type': event_type,
        'topic': topic,
        'score': score,
        'total': total,
        'difficulty': difficulty,
        'payload': payload or {},
        'timestamp': datetime.utcnow().isoformat(),
    })
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(events, f, ensure_ascii=False, indent=2)


def get_events(user_id: str) -> list[dict]:
    path = os.path.join(STORAGE_DIR, f'{user_id}.json')
    if not os.path.exists(path):
        return []
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return []


def get_events_dataframe(user_id: str):
    import pandas as pd
    events = get_events(user_id)
    if not events:
        return pd.DataFrame(columns=['event_type', 'topic', 'score', 'total', 'difficulty', 'payload', 'timestamp'])
    df = pd.DataFrame(events)
    df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
    return df
