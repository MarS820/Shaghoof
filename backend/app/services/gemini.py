"""Gemini AI integration: question generation & conceptual evaluation.

Uses google-generativeai. If no API key is present it falls back to a
deterministic heuristic so the app never hard-crashes during demos.
"""
import os
import json
import re
from ..core.config import settings

# Current production Flash model. Keep the name in one place so the backend
# does not quietly fall back to untranslated content when a retired model is used.
# Fallbacks kick in when the primary model is overloaded (503) or retired.
MODEL_NAME = "gemini-3.6-flash"
MODEL_FALLBACKS = ["gemini-3.5-flash-lite", "gemini-2.5-flash"]
_genai_ready = False
_client = None
_use_new_api = False


def _init():
    global _genai_ready, _client, _use_new_api
    key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")
    if not key:
        _genai_ready = False
        return
    # Prefer the new google-genai SDK
    try:
        from google import genai
        _client = genai.Client(api_key=key)
        _use_new_api = True
        _genai_ready = True
        return
    except Exception:
        pass
    # Fall back to the deprecated google-generativeai SDK
    try:
        import google.generativeai as _fallback_genai
        _fallback_genai.configure(api_key=key)
        _client = _fallback_genai.GenerativeModel(MODEL_NAME)
        _use_new_api = False
        _genai_ready = True
    except Exception:
        _genai_ready = False


_init()


def _generate(prompt):
    """Generate content using whichever SDK is active.

    Tries the primary model first, then fallbacks, so a single overloaded
    (503) or retired model doesn't take the AI service down.
    """
    if not ai_available():
        return None
    if _use_new_api:
        last_err = None
        for model in [MODEL_NAME, *MODEL_FALLBACKS]:
            try:
                resp = _client.models.generate_content(model=model, contents=prompt)
                if resp and resp.text:
                    return resp.text
            except Exception as exc:
                last_err = exc
                continue
        if last_err is not None:
            raise last_err
        return None
    else:
        resp = _client.generate_content(prompt)
        return resp.text


def ai_available():
    return _genai_ready


def safe_parse_json(text):
    """Extract a JSON object/array from model output (handles markdown fences)."""
    if not text:
        return None
    text = text.strip()
    # Try direct parse first
    try:
        return json.loads(text)
    except Exception:
        pass
    # Handle markdown code fences (json or plain)
    fence = re.search(r"```(?:json)?\s*(\[.*?\]|\{.*?\})\s*```", text, re.DOTALL)
    if fence:
        try:
            return json.loads(fence.group(1))
        except Exception:
            pass
    # Fallback: find first [ or { ... matching closing bracket
    for opener, closer in (("[", "]"), ("{", "}")):
        start = text.find(opener)
        if start != -1:
            end = text.rfind(closer)
            if end > start:
                try:
                    return json.loads(text[start : end + 1])
                except Exception:
                    pass
    return None


def _prompt_generate(topic, age, style, count, difficulty="medium", language="en", subject=None, extra=""):
    if language == "ar":
        lang_instr = "Write ALL questions, options, and explanations in Arabic (Modern Standard Arabic)."
    else:
        lang_instr = "Write ALL questions, options, and explanations in English."
    diff_label = {"easy": "very easy and simple", "medium": "slightly challenging", "hard": "challenging and thought-provoking"}.get(difficulty, "appropriately challenging")
    age_guidance = (
        "Use very short sentences, familiar real-life examples, and one-step thinking."
        if age <= 9 else
        "Use clear concrete examples and no more than one or two reasoning steps."
        if age <= 12 else
        "Use age-appropriate school vocabulary and practical, multi-step thinking."
        if age <= 15 else
        "Use secondary-school vocabulary and authentic applications, without university-level material."
    )
    is_math = (subject or "").lower() == "math" or any(word in topic.lower() for word in ("math", "equation", "fraction", "algebra", "number"))
    notation_rule = (
        "Mathematical notation is allowed only when it is essential. Use plain Unicode such as x²; never use $, LaTex, or backslash commands."
        if is_math else
        "Do not use equations, algebra, functions, calculus, or mathematical notation: this is not a mathematics question."
    )
    return f"""
You are an expert educational question generator for students aged {age}.
Create {count} multiple-choice question(s) about: "{topic}".
Learning style focus: {style}.

{lang_instr}
Difficulty level: {diff_label} for a {age}-year-old.

Requirements:
- Every question must test a DISTINCT idea or scenario. Never repeat or lightly reword a previous question.
- Each question must be pedagogically sound and factually correct for that age.
- Age calibration: {age_guidance}
- Subject boundary: {notation_rule}
- Keep each question below 55 words and each answer option below 16 words. Write clean, readable plain text.
- Provide exactly 4 options labeled A, B, C, D. Exactly one is correct.
- Provide a clear kid-friendly explanation in 'concept' (why the answer is right and the key idea).
- Provide 'keywords' (3-5 short key terms) that capture the core idea for lenient grading.

Return STRICT JSON as an array of objects:
[
  {{
    "id": "unique-string-id",
    "question": "...",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
    "correct_index": 0,
    "concept": "...",
    "keywords": ["key1", "key2"],
    "style": "{style}",
    "difficulty": "{difficulty}"
  }}
]
{extra}
"""


def _quiz_format_extra(template_id, quiz_format):
    formats = {
        "sandbox": "Write each stem as a short hands-on quest the student can complete by placing one answer. Avoid 'which of the following'. Keep options as concrete actions or objects.",
        "podcast": "Write stems that work when read aloud first. Options should be short spoken phrases, not long clauses.",
        "storyboard": "Write a concrete visual scene in the stem. Options should be distinct pictured outcomes, no abstract metaphors.",
        "translator": "Use simple sentences and a glossary-friendly keyword list. Options should be short written answers a student might type.",
        "explorer": "Tie the stem to a diagram or labelled parts. Options name clickable regions or relationships.",
        "routine": "Use concrete language and one step at a time. Options should be short, parallel, and unambiguous.",
    }
    hint = formats.get(quiz_format)
    if not hint and template_id:
        hint = {
            "T1": formats["sandbox"],
            "T2": formats["podcast"],
            "T3": formats["storyboard"],
            "T4": formats["translator"],
            "T5": formats["explorer"],
            "T6": formats["routine"],
        }.get(str(template_id).upper())
    if not hint:
        return ""
    return f"- Interaction format ({template_id or quiz_format}): {hint}\n- Still return exactly 4 options and one correct_index so the app can grade any interaction style."



def generate_questions(topic, age, style="reading", count=4, difficulty="medium", language="en", subject=None, template_id=None, quiz_format=None):
    """Generate questions via Gemini; fall back to template questions."""
    extra = _quiz_format_extra(template_id, quiz_format)
    if ai_available():
        try:
            text = _generate(_prompt_generate(topic, age, style, count, difficulty, language, subject, extra))
            data = safe_parse_json(text)
            if data and isinstance(data, list) and len(data) >= count and _questions_are_usable(data[:count], topic, age, subject):
                return data[:count]
        except Exception:
            pass
    fallback = _fallback_questions(topic, age, style, count)
    # The fallback bank is authored in English. Localize its question and
    # choices before returning it so an Arabic exam never starts in English.
    if language == "ar":
        for item in fallback:
            item["question"] = _template_translate(item["question"], "ar")
            item["options"] = [
                _template_translate(option, "ar") for option in item["options"]
            ]
    return fallback


def translate_text(text, target_lang):
    """Translate text to target_lang ('ar' or 'en') using Gemini.

    Falls back gracefully if AI unavailable. Returns original text if no
    translation is needed or possible.
    """
    if not text:
        return text
    if target_lang == "en" and _is_mostly_ascii(text):
        return text
    if target_lang == "ar" and not _is_mostly_ascii(text):
        return text
    # The fallback question bank has known, high-quality Arabic wording.
    # Resolve it before making a network call so the translate button stays
    # instant even when an AI provider is slow or temporarily unavailable.
    template_translation = _template_translate(text, target_lang)
    if template_translation != text:
        return template_translation
    if ai_available():
        try:
            prompt = (
                f"Translate the following text into {'Arabic (Modern Standard Arabic)' if target_lang == 'ar' else 'English'}. "
                f"Return ONLY the translated text, no quotes, no explanation, no labels:\n\n{text}"
            )
            out = _generate(prompt)
            if out and out.strip():
                translated = out.strip().strip('"')
                # Some providers can return the source text even after a
                # successful request. Do not present that as a translation.
                if target_lang == "ar" and not _is_mostly_ascii(translated):
                    return translated
                if target_lang == "en" and _is_mostly_ascii(translated):
                    return translated
        except Exception:
            pass
    # Offline/demo fallback for the platform's generated question templates.
    # Unlike the old behaviour, it translates the phrases we own instead of
    # silently returning the same language to the student.
    return template_translation


def _template_translate(text, target_lang):
    source = str(text)
    en_to_ar = {
        "What is water?": "ما هو الماء؟",
        "A. Liquid": "أ. سائل",
        "B. Rock": "ب. صخرة",
        "It uses the important ideas you learned": "إنها تستخدم الأفكار المهمة التي تعلمتها",
        "It ignores all the important ideas": "إنها تتجاهل الأفكار المهمة",
        "It means you should stop learning": "تعني أنه يجب أن تتوقف عن التعلم",
        "It has no connection to the lesson": "ليس لها علاقة بالدرس",
        "The central lesson or rule": "الفكرة أو القاعدة الأساسية",
        "A detail unrelated to the topic": "تفصيلة لا ترتبط بالموضوع",
        "A reason to stop learning": "سبب للتوقف عن التعلم",
        "A random fact with no meaning": "معلومة عشوائية بلا معنى",
        "A real situation where the idea is used": "موقف حقيقي تُستخدم فيه الفكرة",
        "An unrelated fact": "حقيقة غير مرتبطة",
        "A guess without evidence": "تخمين بلا دليل",
        "Avoid using the idea": "تجنب استخدام الفكرة",
        "It helps solve real problems": "لأنه يساعد على حل مشكلات حقيقية",
        "It makes every task impossible": "لأنه يجعل كل مهمة مستحيلة",
        "It is only useful for one minute": "لأنه مفيد لدقيقة واحدة فقط",
        "It has no use at all": "لأنه لا فائدة منه إطلاقًا",
        "The important information and what is being asked": "المعلومات المهمة وما المطلوب",
        "Choose an answer before reading": "اختيار إجابة قبل القراءة",
        "Skip all of the details": "تجاهل كل التفاصيل",
        "Use a random rule": "استخدام قاعدة عشوائية",
        "Use a simple example and the key idea": "استخدام مثال بسيط والفكرة الأساسية",
        "Say it cannot be explained": "القول إنه لا يمكن شرحه",
        "Use unrelated words": "استخدام كلمات غير مرتبطة",
        "Only repeat the title": "تكرار العنوان فقط",
    }
    ar_to_en = {
        "ما هو الماء؟": "What is water?",
        "أ. سائل": "A. Liquid",
        "ب. صخرة": "B. Rock",
        "إنها تستخدم الأفكار المهمة التي تعلمتها": "It uses the important ideas you learned",
        "إنها تتجاهل الأفكار المهمة": "It ignores all the important ideas",
        "تعني أنه يجب أن تتوقف عن التعلم": "It means you should stop learning",
        "ليس لها علاقة بالدرس": "It has no connection to the lesson",
    }
    table = en_to_ar if target_lang == "ar" else ar_to_en
    if source in table:
        return table[source]
    if target_lang == "ar":
        patterns = (
            (r"^What is the main idea of (.+)\?$", "ما الفكرة الرئيسية في {}؟"),
            (r"^Which example best shows (.+) in action\?$", "أي مثال يوضح {} في الواقع؟"),
            (r"^Why is (.+) useful to learn\?$", "لماذا يُعد تعلم {} مفيدًا؟"),
            (r"^What should you check first when solving a problem about (.+)\?$", "ما أول شيء يجب التحقق منه عند حل مسألة عن {}؟"),
            (r"^How could you explain (.+) to a friend\?$", "كيف يمكنك شرح {} لصديق؟"),
        )
        for pattern, template in patterns:
            match = re.match(pattern, source)
            if match:
                return template.format(match.group(1))
    # Phrase substitutions preserve topic names when no online model exists.
    translated = source
    for original, replacement in sorted(table.items(), key=lambda item: len(item[0]), reverse=True):
        translated = translated.replace(original, replacement)
    return translated


def _is_mostly_ascii(text):
    if not text:
        return True
    non_ascii = sum(1 for c in text if ord(c) > 127)
    return non_ascii / max(len(text), 1) < 0.3


def _fallback_questions(topic, age, style, count):
    prompts = [
        (
            f"What is the main idea of {topic}?",
            f"Understanding the main idea helps you learn {topic}.",
            ["The central lesson or rule", "A detail unrelated to the topic", "A reason to stop learning", "A random fact with no meaning"],
        ),
        (
            f"Which example best shows {topic} in action?",
            f"Examples connect {topic} to real life.",
            ["A real situation where the idea is used", "An unrelated fact", "A guess without evidence", "Avoid using the idea"],
        ),
        (
            f"Why is {topic} useful to learn?",
            f"Knowing why it matters makes {topic} easier to remember.",
            ["It helps solve real problems", "It makes every task impossible", "It is only useful for one minute", "It has no use at all"],
        ),
        (
            f"What should you check first when solving a problem about {topic}?",
            f"Starting with key information is an important {topic} skill.",
            ["The important information and what is being asked", "Choose an answer before reading", "Skip all of the details", "Use a random rule"],
        ),
        (
            f"How could you explain {topic} to a friend?",
            f"Explaining an idea is a powerful way to understand {topic}.",
            ["Use a simple example and the key idea", "Say it cannot be explained", "Use unrelated words", "Only repeat the title"],
        ),
    ]
    qs = []
    for i in range(count):
        question, concept, options = prompts[i % len(prompts)]
        qs.append(
            {
                "id": f"{re.sub(r'\W+', '', topic).lower()}_{i}",
                "question": question,
                "options": options,
                "correct_index": 0,
                "concept": concept,
                "keywords": [topic.lower(), "learn", "understand"],
                "style": style,
                "difficulty": "easy",
            }
        )
    return qs


def _questions_are_distinct(questions):
    normalized = [
        re.sub(r"\W+", "", str(item.get("question", "")).lower())
        + "|"
        + re.sub(r"\W+", "", " ".join(map(str, item.get("options", []))).lower())
        for item in questions
    ]
    return len(normalized) == len(set(normalized)) and all(normalized)


def _questions_are_usable(questions, topic, age, subject=None):
    """Reject malformed or out-of-subject model output before a student sees it."""
    if not _questions_are_distinct(questions):
        return False
    topic_is_math = (subject or "").lower() == "math" or any(
        word in str(topic).lower() for word in ("math", "equation", "fraction", "algebra", "number")
    )
    math_markers = ("f(", "g(", "polynomial", "integral", "derivative", "^", "$", "\\\\")
    max_words = 42 if age <= 12 else 55
    for item in questions:
        question = str(item.get("question", "")).strip()
        options = item.get("options", [])
        if not question or len(question.split()) > max_words or len(options) != 4:
            return False
        if any(not str(option).strip() or len(str(option).split()) > 16 for option in options):
            return False
        if not isinstance(item.get("correct_index"), int) or item["correct_index"] not in range(4):
            return False
        text = " ".join([question, *map(str, options)]).lower()
        if "$" in text or "\\" in text:
            return False
        if not topic_is_math and any(marker in text for marker in math_markers):
            return False
    return True


def evaluate_conceptual(reasoning, question, answer):
    """Pass 2: conceptual logic check via Gemini.

    Returns dict with 'level' in {Mastery, Partial, Fail} and a feedback string.
    """
    if ai_available():
        try:
            prompt = f"""
You are a patient teacher. Evaluate this student's reasoning for conceptual understanding.

Question: {question}
Correct answer: {answer}
Student reasoning: {reasoning}

Classify conceptual understanding as one of: "Mastery", "Partial", or "Fail".
- Mastery: reasoning is logically sound and shows genuine understanding.
- Partial: reasoning shows some correct ideas but has gaps.
- Fail: reasoning is blank, off-topic, or fundamentally wrong.

Return STRICT JSON: {{"level": "Mastery", "feedback": "short supportive feedback in simple language"}}
"""
            text = _generate(prompt)
            data = safe_parse_json(text)
            if data and data.get("level"):
                return {
                    "level": data.get("level"),
                    "feedback": data.get("feedback", ""),
                }
        except Exception:
            pass
    # Heuristic fallback
    if not reasoning or not reasoning.strip():
        return {"level": "Fail", "feedback": ""}
    lowered = reasoning.lower()
    if len(reasoning.split()) >= 5:
        return {"level": "Partial", "feedback": ""}
    return {"level": "Fail", "feedback": ""}
