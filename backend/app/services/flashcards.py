from __future__ import annotations
import os
import json
import logging
from typing import Optional

from ..core.config import settings

logger = logging.getLogger(__name__)

try:
    from groq import Groq
except ImportError:
    Groq = None  # type: ignore[assignment,misc]


def generate_flashcards(
    topic: str,
    n: int = 8,
    weak_topics: Optional[list[str]] = None,
    api_key: Optional[str] = None,
) -> list[dict]:
    topic = (topic or "").strip()
    if not topic:
        raise ValueError("`topic` must be a non-empty string.")
    n = max(1, min(int(n), 30))

    key = api_key or settings.GROQ_API_KEY or os.getenv("GROQ_API_KEY", "")
    if not key or Groq is None:
        return [{"front": topic, "back": f"Study material for {topic}."}]

    focus = ""
    if weak_topics:
        focus = f"\nPay extra attention to: {', '.join(weak_topics)}."

    prompt = f"""Generate exactly {n} flashcards for: '{topic}'.{focus}

CRITICAL: Interpret topics strictly within AI / Computer Science / Software Engineering.
Return JSON: {{"cards": [{{"front": "...", "back": "..."}}, ...]}}
"""
    try:
        client = Groq(api_key=key)
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": (
                    "You are an expert CS/AI tutor. Always interpret topics "
                    "within software engineering / AI / CS context. Respond only with valid JSON."
                )},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            response_format={"type": "json_object"},
            max_tokens=2000,
        )
        raw = response.choices[0].message.content or "{}"
        data = json.loads(raw)
        cards = [c for c in data.get("cards", [])
                 if isinstance(c, dict) and "front" in c and "back" in c]
        return cards[:n] if cards else [{"front": topic, "back": f"Key concept: {topic}."}]
    except Exception as exc:
        logger.warning("Flashcard generation failed: %s", exc)
        return [{"front": topic, "back": f"Study material for {topic}."}]
