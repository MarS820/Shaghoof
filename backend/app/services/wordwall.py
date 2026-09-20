"""Wordwall-style game packs, generated exclusively from a lesson's own content.

Every pack is derived ONLY from the lesson material (sections, key concepts,
vocabulary) — never invented — and the game KIND is chosen by the student's
active template so each template gets an activity that suits it:

    T1 The Sandbox   (kinesthetic) → match-up pairs (tap term ↔ meaning)
    T2 Story Stage   (auditory)    → true/false listening quiz
    T3 Diagram Quest (visual)      → image/emoji word-image grid
    T4 Word Vault    (reading)     → missing-word (cloze fill-in) game
    T5 Paint & Play  (visual/K)    → spin-the-wheel concept reveal
    T6 Step Ladder   (reading/K)   → random-wheel + true/false speed round

Also provides a shared "game pack" section embedded in every generated lesson,
and a small public API for the frontend to (re)generate packs for an existing
lesson.
"""

from __future__ import annotations

import re

logger = __import__("logging").getLogger(__name__)

# ── Template → game kind mapping (exclusive per template) ─────────────────────

TEMPLATE_GAME = {
    "T1": "match",
    "T2": "truefalse",
    "T3": "wordimage",
    "T4": "missingword",
    "T5": "wheel",
    "T6": "wheel",
    # Enhanced game types for richer activities
    "T1_enhanced": "sequence",  # For kinesthetic learners: ordering concepts
    "T2_enhanced": "fillblank",  # For auditory learners: fill-in-the-blank
    "T3_enhanced": "match",     # For visual learners: matching pairs
    "T4_enhanced": "truefalse", # For reading/writing learners: true/false
    "T5_enhanced": "wordimage", # For visual/kinesthetic: picture words
    "T6_enhanced": "sequence",  # For structure learners: ordering steps
}

GAME_LABELS = {
    "match": {"en": "Match-Up", "ar": "وصال"},
    "truefalse": {"en": "True or False Sprint", "ar": "صح أم خطأ"},
    "wordimage": {"en": "Picture Words", "ar": "كلمات بالصور"},
    "missingword": {"en": "Missing Word", "ar": "الكلمة الناقصة"},
    "wheel": {"en": "Spin the Wheel", "ar": "عجلة الدوران"},
    "sequence": {"en": "Order the Steps", "ar": "ترتيب الخطوات"},
    "fillblank": {"en": "Complete the Sentence", "ar": "أكمل الجملة"},
}

# Emoji hints for the picture-word game (visual template).
_EMOJI_HINTS = [
    ("water", "💧"), ("sun", "☀️"), ("plant", "🌿"), ("cloud", "☁️"), ("rain", "🌧️"),
    ("fire", "🔥"), ("earth", "🌍"), ("moon", "🌙"), ("star", "⭐"), ("tree", "🌳"),
    ("animal", "🐾"), ("food", "🍎"), ("book", "📖"), ("music", "🎵"), ("energy", "⚡"),
    ("heat", "🌡️"), ("ice", "🧊"), ("wind", "🌬️"), ("rock", "🪨"), ("light", "💡"),
    ("cell", "🔬"), ("atom", "⚛️"), ("math", "➗"), ("number", "🔢"), ("money", "💰"),
    ("clock", "⏰"), ("heart", "❤️"), ("brain", "🧠"), ("eye", "👀"), ("hand", "✋"),
]


# ── Content extraction (strictly from the lesson) ────────────────────────────

def _concept_text(c) -> str:
    return (c if isinstance(c, str) else (c.get("text") or c.get("term") or "")).strip()


def _pairs_from_lesson(lesson: dict) -> list[dict]:
    """term/definition pairs from vocabulary, falling back to key concepts."""
    pairs: list[dict] = []
    seen = set()
    for v in lesson.get("vocabulary") or []:
        term = str(v.get("term", "")).strip()
        definition = str(v.get("definition", "")).strip()
        if term and definition and term.lower() not in seen:
            pairs.append({"term": term, "definition": definition})
            seen.add(term.lower())
    for c in lesson.get("key_concepts") or []:
        text = _concept_text(c)
        if text and text.lower() not in seen:
            pairs.append({"term": text, "definition": ""})
            seen.add(text.lower())
    return pairs[:8]


def _sentences_from_lesson(lesson: dict) -> list[str]:
    """Clean content sentences from the lesson sections."""
    sentences: list[str] = []
    for s in lesson.get("sections") or []:
        text = (s.get("text") or "").strip()
        if not text or s.get("type") in {"heading", "subheading"}:
            continue
        for sent in re.split(r"(?<=[.!?؟])\s+", text):
            sent = sent.strip()
            words = sent.split()
            # Game-playable sentences: complete, not too long, not too short.
            if 6 <= len(words) <= 30 and sent[0].isupper() is not False:
                sentences.append(sent)
    return sentences


def _lesson_title(lesson: dict) -> str:
    return (lesson.get("title") or "").strip() or "This lesson"


# ── Game builders ─────────────────────────────────────────────────────────────

def _build_match(pairs: list[dict]) -> dict | None:
    """T1 Sandbox: tap-a-term → tap-its-meaning matching pairs."""
    usable = [p for p in pairs if p["definition"]]
    if len(usable) < 3:
        return None
    return {
        "kind": "match",
        "title": "Match-Up",
        "pairs": [
            {"id": f"p{i}", "term": p["term"], "definition": p["definition"]}
            for i, p in enumerate(usable[:6])
        ],
    }


def _build_truefalse(lesson: dict, sentences: list[str], pairs: list[dict]) -> dict | None:
    """T2 Story Stage: quick true/false statements grounded in lesson sentences."""
    import random
    rng = random.Random(_lesson_title(lesson))
    items: list[dict] = []
    truths = list(sentences)[:4]
    for sent in truths:
        items.append({"statement": sent, "answer": True})
    # False statements: swap a key term from a real sentence into another's.
    term_pool = [p["term"] for p in pairs if p["term"]] or [w for s in truths[:2] for w in
                 re.findall(r"[A-Za-z\u0600-\u06ff]{4,}", s)]
    for sent in truths[:3]:
        swap = next((t for t in term_pool if t.lower() not in sent.lower()), None)
        if not swap:
            continue
        original = next((t for t in term_pool if t.lower() in sent.lower()), None)
        if not original:
            continue
        items.append({"statement": sent.replace(original, swap, 1), "answer": False})
    if len(items) < 4:
        return None
    rng.shuffle(items)
    return {"kind": "truefalse", "title": "True or False Sprint", "items": items[:6]}


def _build_wordimage(pairs: list[dict]) -> dict | None:
    """T3 Diagram Quest: emoji-pictured term game."""
    if not pairs:
        return None
    items = []
    for p in pairs[:6]:
        emoji = "🔎"
        low = p["term"].lower()
        for key, em in _EMOJI_HINTS:
            if key in low or low in key:
                emoji = em
                break
        items.append({"term": p["term"], "emoji": emoji, "definition": p["definition"]})
    return {"kind": "wordimage", "title": "Picture Words", "items": items}


def _build_missingword(lesson: dict, sentences: list[str], pairs: list[dict]) -> dict | None:
    """T4 Word Vault: cloze sentences — fill the missing key word."""
    import random
    rng = random.Random(_lesson_title(lesson))
    terms = [p["term"] for p in pairs if p["term"]]
    if not terms:
        return None
    items: list[dict] = []
    for sent in sentences:
        match = next((t for t in terms if re.search(rf"\b{re.escape(t)}\b", sent)), None)
        if not match:
            continue
        blanked = sent.replace(match, "______", 1)
        options = [match]
        distractors = [t for t in terms if t != match]
        rng.shuffle(distractors)
        options += distractors[:3]
        rng.shuffle(options)
        items.append({"sentence": blanked, "answer": match, "options": options})
        if len(items) >= 6:
            break
    if not items:
        # Fall back to blanking a meaningful mid-sentence word.
        for sent in sentences[:6]:
            words = sent.split()
            if len(words) < 6:
                continue
            idx = rng.randrange(1, len(words) - 1)
            answer = words[idx].strip(".,!?؟;:")
            if len(answer) < 3:
                continue
            blanked = " ".join(words[:idx] + ["______"] + words[idx + 1:])
            items.append({"sentence": blanked, "answer": answer, "options": []})
    return {"kind": "missingword", "title": "Missing Word", "items": items[:6]} if items else None


def _build_wheel(lesson: dict, pairs: list[dict], sentences: list[str]) -> dict | None:
    """T5/T6: spin-the-wheel concept reveal with a follow-up challenge."""
    concepts = [p["term"] for p in pairs if p["term"]]
    if not concepts:
        concepts = [w for s in sentences[:2] for w in re.findall(r"[A-Za-z\u0600-\u06ff]{5,}", s)][:8]
    concepts = list(dict.fromkeys(concepts))[:8]
    if not concepts:
        return None
    return {
        "kind": "wheel",
        "title": "Spin the Wheel",
        "segments": concepts,
        "lesson_title": _lesson_title(lesson),
        "prompt": {"en": "Explain it in your own words — or give an example!", "ar": "اشرحها بكلماتك — أو أعطِ مثالاً!"},
    }


def _build_sequence(lesson: dict, pairs: list[dict], sentences: list[str]) -> dict | None:
    """T1/T6: sequence ordering game for kinesthetic/structure learners."""
    import random
    rng = random.Random(_lesson_title(lesson))
    
    # Try to get concepts from key_concepts or vocabulary
    concepts = []
    for c in lesson.get("key_concepts") or []:
        text = _concept_text(c)
        if text:
            concepts.append(text)
    
    # If not enough concepts, extract from sentences
    if len(concepts) < 3:
        for sent in sentences[:5]:
            # Extract meaningful phrases
            words = re.findall(r"[A-Za-z\u0600-\u06ff]{4,}", sent)
            if len(words) >= 2:
                phrase = " ".join(words[:3])
                if phrase not in concepts:
                    concepts.append(phrase)
    
    concepts = list(dict.fromkeys(concepts))[:6]
    if len(concepts) < 3:
        return None
    
    # Shuffle for the game
    shuffled = list(concepts)
    rng.shuffle(shuffled)
    
    return {
        "kind": "sequence",
        "title": "Order the Steps",
        "items": [
            {"id": f"s{i}", "text": concept, "correct_position": i}
            for i, concept in enumerate(concepts)
        ],
        "shuffled": shuffled,
        "lesson_title": _lesson_title(lesson),
    }


def _build_fillblank(lesson: dict, pairs: list[dict], sentences: list[str]) -> dict | None:
    """T2: fill-in-the-blank game for auditory learners."""
    import random
    rng = random.Random(_lesson_title(lesson))
    
    terms = [p["term"] for p in pairs if p["term"]]
    if not terms:
        # Extract terms from sentences
        for sent in sentences[:5]:
            words = re.findall(r"[A-Za-z\u0600-\u06ff]{5,}", sent)
            terms.extend(words[:2])
    
    terms = list(dict.fromkeys(terms))[:8]
    if not terms:
        return None
    
    items = []
    for sent in sentences[:8]:
        # Find a term in the sentence
        match = next((t for t in terms if re.search(rf"\b{re.escape(t)}\b", sent, re.I)), None)
        if not match:
            continue
        
        # Create blanked version
        blanked = re.sub(rf"\b{re.escape(match)}\b", "______", sent, count=1, flags=re.I)
        
        # Create options (correct + distractors)
        options = [match]
        distractors = [t for t in terms if t != match]
        rng.shuffle(distractors)
        options += distractors[:3]
        rng.shuffle(options)
        
        items.append({
            "sentence": blanked,
            "answer": match,
            "options": options,
            "original": sent
        })
        
        if len(items) >= 5:
            break
    
    if not items:
        return None
    
    return {
        "kind": "fillblank",
        "title": "Complete the Sentence",
        "items": items,
        "lesson_title": _lesson_title(lesson),
    }


# ── Public API ────────────────────────────────────────────────────────────────

def build_pack(lesson: dict, template_id: str | None = None) -> dict | None:
    """Build the template-exclusive Wordwall pack for a lesson.

    Returns None when the lesson is too thin to gamify honestly (never pads
    with invented content).
    """
    if not isinstance(lesson, dict):
        return None
    template_id = template_id or lesson.get("template_id") or "T3"
    kind = TEMPLATE_GAME.get(template_id, "wordimage")
    pairs = _pairs_from_lesson(lesson)
    sentences = _sentences_from_lesson(lesson)

    pack = None
    if kind == "match":
        pack = _build_match(pairs)
    elif kind == "truefalse":
        pack = _build_truefalse(lesson, sentences, pairs)
    elif kind == "wordimage":
        pack = _build_wordimage(pairs)
    elif kind == "missingword":
        pack = _build_missingword(lesson, sentences, pairs)
    elif kind == "wheel":
        pack = _build_wheel(lesson, pairs, sentences)
    elif kind == "sequence":
        pack = _build_sequence(lesson, pairs, sentences)
    elif kind == "fillblank":
        pack = _build_fillblank(lesson, pairs, sentences)

    # Graceful degradation within the same template family — never cross the
    # template's game identity, just fall back to a lighter variant.
    if pack is None and kind in {"truefalse", "missingword", "fillblank"}:
        pack = _build_wordimage(pairs)
    if pack is None and kind in {"match", "sequence"}:
        pack = _build_wheel(lesson, pairs, sentences)

    if pack:
        pack["template_id"] = template_id
        pack["game"] = GAME_LABELS.get(pack["kind"], {"en": pack["kind"], "ar": pack["kind"]})
    return pack


def attach_pack(lesson: dict, template_id: str | None = None) -> dict:
    """Attach the game pack to a lesson dict (used at generation time)."""
    try:
        pack = build_pack(lesson, template_id)
        if pack:
            lesson["wordwall"] = pack
    except Exception as exc:
        logger.warning("Wordwall pack generation failed: %s", exc)
    return lesson
