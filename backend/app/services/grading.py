"""C1 & C2: Assessment and Stretch-Zone grading logic.

Implements:
- Two-Pass Grading (Pass 1 correctness, Pass 2 conceptual via Gemini)
- Spelling-forgiving grading (dyslexia)
- Misconception Bins
- Keyword matching (lenient, for audio/text stretch assessments)
- Growth Scoring
- Weakest style detection
"""
import re
from difflib import SequenceMatcher


# ------------------------- Misc utilities -------------------------

def _norm(text):
    """Lowercase, collapse whitespace, drop punctuation for comparison."""
    text = unicode_normalize(text)
    text = re.sub(r"[^a-z0-9\u0600-\u06FF ]", "", text.lower())
    return " ".join(text.split())


def unicode_normalize(text):
    import unicodedata
    return unicodedata.normalize("NFKD", text)


# ------------------------- Misconception Bins -------------------------

MISCONCEPTION_BINS = {
    "sign_error": {
        "keywords": ["negative", "minus", "sign", "positive"],
        "label": "Sign / Direction error",
        "arabic": "خطأ في الإشارة (موجب/سالب)",
        "hint": "Review the sign rules carefully.",
    },
    "unit_error": {
        "keywords": ["cm", "mm", "kg", "g", "liter", "ml", "unit"],
        "label": "Unit conversion error",
        "arabic": "خطأ في تحويل الوحدات",
        "hint": "Check that both values use the same unit.",
    },
    "operation_order": {
        "keywords": ["order", "bracket", "parenthes", "first", "divide", "multiply"],
        "label": "Operation order error",
        "arabic": "خطأ في ترتيب العمليات",
        "hint": "Remember: brackets, then × ÷, then + −.",
    },
    "concept_confusion": {
        "keywords": ["example", "definition", "means", "similar", "different"],
        "label": "Concept confusion",
        "arabic": "خلط بين المفاهيم",
        "hint": "Review the core definition of the concept.",
    },
    "reading_error": {
        "keywords": ["read", "careful", "misread", "option", "asked"],
        "label": "Reading / attention error",
        "arabic": "خطأ في القراءة / الانتباه",
        "hint": "Read the question twice before answering.",
    },
}


def classify_misconception(question, student_answer, correct_answer="", reasoning=""):
    """Classify a wrong answer into a misconception bin."""
    text = " ".join([str(question), str(student_answer), str(reasoning)]).lower()
    # Judge longest keyword matches first
    bins = sorted(
        MISCONCEPTION_BINS.items(),
        key=lambda kv: max(len(k) for k in kv[1]["keywords"]),
        reverse=True,
    )
    for key, bin_ in bins:
        for kw in bin_["keywords"]:
            if _contains_word(text, kw):
                return key
    return "other"


def _contains_word(text, word):
    return re.search(rf"\b{re.escape(word)}\w*\b", text) is not None


# ------------------------- Spelling-forgiving -------------------------

def spelling_forgiving_equal(a, b):
    """True if strings match ignoring common spelling/typo variations."""
    a_n = _norm(a)
    b_n = _norm(b)
    if a_n == b_n:
        return True
    # Fuzzy ratio
    ratio = SequenceMatcher(None, a_n, b_n).ratio()
    return ratio >= 0.85


# ------------------------- Pass 1: Correctness -------------------------

def pass1_correctness(question, student_answer, correct_answer, dyslexic=False, answer_type="string"):
    """Rule-based correctness check.

    Handles numeric answers with tolerance and string answers (with
    spelling-forgiving when the student is dyslexic).
    """
    if student_answer is None or str(student_answer).strip() == "":
        return {"correct": False, "score": 0.0, "reason": "blank"}

    if answer_type == "numeric":
        try:
            sa = float(str(student_answer).replace(",", "."))
            ca = float(str(correct_answer).replace(",", "."))
            tol = max(0.01, abs(ca) * 0.05)
            correct = abs(sa - ca) <= tol
            return {
                "correct": correct,
                "score": 1.0 if correct else 0.0,
                "reason": "numeric",
            }
        except Exception:
            return {"correct": False, "score": 0.0, "reason": "invalid-number"}

    # string comparison
    if dyslexic:
        match = spelling_forgiving_equal(student_answer, correct_answer)
    else:
        match = _norm(student_answer) == _norm(correct_answer)
    return {
        "correct": match,
        "score": 1.0 if match else 0.0,
        "reason": "string",
    }


# ------------------------- Lenient / Keyword matching -------------------------

def keyword_match_score(student_answer, keywords):
    """Score 0-100 based on how many key concepts were captured."""
    if not keywords:
        return 100.0 if str(student_answer).strip() else 0.0
    text = _norm(str(student_answer))
    if not text:
        return 0.0
    hits = 0
    for kw in keywords:
        if _contains_word(text, kw.lower()):
            hits += 1
    return round(((hits / len(keywords)) * 100), 1)


def lenient_grade(student_answer, keywords, threshold=60):
    """Lenient grading: Great Attempt if keyword capture >= threshold."""
    score = keyword_match_score(student_answer, keywords)
    passed = score >= threshold
    label = "Great Attempt" if passed else "Keep Trying"
    return {
        "score": score,
        "passed": passed,
        "label": label,
        "threshold": threshold,
        "captured_keywords": _captured(student_answer, keywords),
    }


def _captured(student_answer, keywords):
    text = _norm(str(student_answer))
    return [kw for kw in keywords if _contains_word(text, kw.lower())]


# ------------------------- Weakest VARK style -------------------------

def weakest_style(vark):
    """Return the VARK style with the lowest score (the stretch zone)."""
    if not vark:
        return "reading"
    return min(vark, key=vark.get)


def dominant_style(vark):
    if not vark:
        return "reading"
    return max(vark, key=vark.get)
