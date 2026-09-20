from __future__ import annotations
import hashlib
import json
import os
import re
import uuid
import logging

from . import web_lesson
from ..core.config import settings

logger = logging.getLogger(__name__)

STORAGE_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'storage', 'lessons')
os.makedirs(STORAGE_DIR, exist_ok=True)

try:
    from langchain_groq import ChatGroq
except ImportError:
    ChatGroq = None

# ── Template-aware generation (master plan: templates × VARK × SEN) ──────────
# Each template gets its own structural directive so the SAME source material
# becomes a genuinely different lesson shape per template.
TEMPLATE_DIRECTIVES: dict[str, str] = {
    'T1': ("THE SANDBOX — hands-on quest format. Structure the lesson as 3-6 SHORT quests. "
           "Each section is one quest: a concrete action (\"Try this: ...\") followed by an "
           "immediate feedback beat (\"What happened? ...\"). No paragraph longer than 2 sentences. "
           "End with a tiny challenge."),
    'T2': ("THE PODCAST — listen-first format. Write flowing conversational narration that "
           "sounds natural when READ ALOUD. Each section is a spoken-style block of at most 3 "
           "short sentences, like a friendly host talking. Add a 'Transcript note:' line after "
           "every second section."),
    'T3': ("THE STORYBOARD — predictable scene format. Use the EXACT same sequence for every "
           "section: 'Scene:' (2 sentences describing something visual), then 'I wonder...?' "
           "(one question), then 'Answer:' (1-2 sentences). Predictable and calm."),
    'T4': ("THE TRANSLATOR — split-reading support format. Use simplified everyday wording in "
           "every sentence. Add a 'Glossary' section that maps each technical term to a plain "
           "one-line definition. Keep all paragraphs to max 3 short sentences. Prefer bullet lists."),
    'T5': ("THE EXPLORER — diagram-plus-bullets format. Open every section with a vivid "
           "'Visualize:' description of a diagram or picture, then 2-4 concise points of max "
           "15 words each. Number the points."),
    'T6': ("THE ROUTINE — calm timeline format. Present content as a numbered step-by-step "
           "timeline. Use concrete, literal language with NO idioms or metaphors. Each step "
           "states exactly what happens. Close each section with a 'Done' checkpoint."),
}

# VARK layer: how the dominant modality shapes the writing.
VARK_DIRECTIVES: dict[str, str] = {
    'visual': 'Write so the student can PICTURE it: describe diagrams, spatial layouts, colors, and shapes.',
    'auditory': 'Write so it SOUNDS good spoken aloud: rhythm, questions, call-and-response phrasing.',
    'reading': 'Write for careful readers: precise definitions, short lists, note-friendly structure.',
    'kinesthetic': 'Write for DOERS: every section includes something to try, build, trace, or act out.',
}

# SEN overlay: accessibility constraints on the writing itself.
SEN_DIRECTIVES: dict[str, str] = {
    'text': 'TEXT SUPPORT overlay: sentences max 12 words. Use the simplest possible vocabulary. Define every technical term inline in brackets.',
    'focus': 'FOCUS overlay: one idea per section, max 2 sentences per paragraph. Bold the single key takeaway of each section.',
    'structure': 'STRUCTURE overlay: strictly predictable section order, explicit numbering (Step 1, Step 2...), literal language only, no idioms or metaphors.',
    'general': '',
}


_FIDELITY_RULES = """\nSOURCE FIDELITY (CRITICAL — HIGHEST PRIORITY):\n- Use ONLY facts, terms and examples contained in the CONTENT above. The lesson\n  teaches exactly this source material — never introduce outside topics, new\n  examples from general knowledge, or related subjects not present in it.\n- Reuse the source's own vocabulary and definitions wherever possible.\n- If the content is thin, create FEWER sections — do not pad with invented material.\n- NEVER invent facts, definitions, examples, or concepts not present in the source.\n- Every claim in the lesson MUST be traceable to a phrase in the source content.\n- Quote the source's terminology exactly when explaining concepts.\n"""


def _template_postprocess(lesson: dict, vark_mode: str, sen_profile: str, template_id: str) -> dict:
    """Attach presentation hints, template metadata and the template-exclusive
    Wordwall game pack (built only from this lesson's content)."""
    from . import content_formatter, wordwall_embed
    try:
        lesson['presentation'] = content_formatter._presentation_hints(vark_mode, sen_profile, [])
    except Exception:
        lesson['presentation'] = {}
    lesson['vark_mode'] = vark_mode
    lesson['sen_profile'] = sen_profile
    lesson['template_id'] = template_id
    try:
        from . import wordwall
        wordwall.attach_pack(lesson, template_id)
    except Exception:
        pass
    
    # Add Wordwall embed suggestions based on lesson topic and template
    try:
        topic = lesson.get('title', '') or lesson.get('topic', '')
        subject = lesson.get('subject', '')
        suggestions = wordwall_embed.get_wordwall_template_suggestions(topic, subject)
        if 'wordwall' not in lesson:
            lesson['wordwall'] = {}
        lesson['wordwall']['embed_suggestions'] = suggestions
    except Exception:
        pass
    
    return lesson


def _gemini_lesson(raw_text: str, title: str, topic: str, source_type: str,
                   vark_mode: str, sen_profile: str, template_id: str) -> dict | None:
    """Gemini fallback for lesson generation (used when no Groq key)."""
    try:
        from . import gemini
        if not gemini.ai_available():
            return None
    except Exception:
        return None
    template_rule = TEMPLATE_DIRECTIVES.get(template_id, TEMPLATE_DIRECTIVES['T3'])
    vark_rule = VARK_DIRECTIVES.get(vark_mode, VARK_DIRECTIVES['visual'])
    sen_rule = SEN_DIRECTIVES.get(sen_profile, '')
    fidelity = _FIDELITY_RULES
    prompt = f"""You are an expert curriculum designer. Create a structured lesson from the following content.

Title: {title}
Topic: {topic or title}
Source type: {source_type}

Content:
{raw_text[:6000]}

Return a JSON object with exactly these fields:
{{
  "title": "lesson title",
  "summary": "2-3 sentence summary",
  "sections": [
    {{"type": "heading", "text": "section heading"}},
    {{"type": "paragraph", "text": "section content paragraph"}},
    {{"type": "subheading", "text": "subheading"}}
  ],
  "key_concepts": ["short term", "another term"],
  "learning_objectives": ["objective 1"],
  "vocabulary": [{{"term": "word", "definition": "meaning"}}]
}}

LESSON FORMAT (follow exactly):
{template_rule}

{fidelity}

LEARNING STYLE (VARK): {vark_rule}
{('# ACCESSIBILITY OVERLAY: ' + sen_rule) if sen_rule else ''}

Rules: 3-6 sections with meaningful content; 3-8 key concepts (each 1-3 words, NEVER a full sentence); 2-4 learning objectives.
Return ONLY valid JSON, no markdown fences"""
    try:
        # Transient Google-side 503/overload spikes are the #1 cause of lessons
        # silently degrading to drafts — retry once before giving up.
        raw = None
        for attempt in range(2):
            raw = gemini._generate(prompt)
            if raw:
                break
            if attempt == 0:
                import time as _time
                _time.sleep(1.5)
        if not raw:
            return None
        parsed = gemini.safe_parse_json(raw)
        if not isinstance(parsed, dict) or not parsed.get('sections'):
            return None
        parsed.setdefault('title', title)
        parsed.setdefault('summary', '')
        parsed.setdefault('key_concepts', [])
        parsed.setdefault('learning_objectives', [])
        parsed.setdefault('vocabulary', [])
        result = _template_postprocess(parsed, vark_mode, sen_profile, template_id)
        result['ai_generated'] = True
        return result
    except Exception as e:
        logger.warning("Gemini lesson generation failed: %s", e)
        return None


def _groq_lesson(raw_text: str, title: str, topic: str, source_type: str,
                 vark_mode: str = 'visual', sen_profile: str = 'general',
                 template_id: str = 'T3') -> dict:
    import os as _os
    api_key = settings.GROQ_API_KEY or _os.getenv("GROQ_API_KEY", "")
    if not api_key or ChatGroq is None:
        # No Groq — try Gemini before the deterministic structurer.
        gem = _gemini_lesson(raw_text, title, topic, source_type, vark_mode, sen_profile, template_id)
        if gem:
            return gem
        base = web_lesson.structure_lesson(raw_text, title=title, topic=topic)
        # Honest flag: the AI was unavailable, so this is a structuring of the
        # source text, not a generated lesson. The UI shows a draft badge.
        base['ai_generated'] = False
        return _template_postprocess(base, vark_mode, sen_profile, template_id)

    try:
        model_name = _os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
        llm = ChatGroq(groq_api_key=api_key, model_name=model_name, temperature=0.3)
        truncated = raw_text[:6000]
        template_rule = TEMPLATE_DIRECTIVES.get(template_id, TEMPLATE_DIRECTIVES['T3'])
        vark_rule = VARK_DIRECTIVES.get(vark_mode, VARK_DIRECTIVES['visual'])
        sen_rule = SEN_DIRECTIVES.get(sen_profile, '')
        fidelity = _FIDELITY_RULES
        prompt = f"""You are an expert curriculum designer. Create a structured lesson from the following content.

Title: {title}
Topic: {topic or title}
Source type: {source_type}

Content:
{truncated}

Return a JSON object with exactly these fields:
{{
  "title": "lesson title",
  "summary": "2-3 sentence summary",
  "sections": [
    {{"type": "heading", "text": "section heading"}},
    {{"type": "paragraph", "text": "section content paragraph"}},
    {{"type": "subheading", "text": "subheading"}}
  ],
  "key_concepts": ["short term", "another term", "third term"],
  "learning_objectives": ["objective 1", "objective 2", "objective 3"],
  "vocabulary": [{{"term": "word", "definition": "meaning"}}]
}}

LESSON FORMAT (follow exactly):
{template_rule}

{fidelity}

LEARNING STYLE (VARK): {vark_rule}
{('# ACCESSIBILITY OVERLAY: ' + sen_rule) if sen_rule else ''}

Rules:
- Include 3-6 sections with meaningful content
- Extract 3-8 key concepts
- Add 2-4 learning objectives
- Add 3-5 vocabulary terms if applicable
- Return ONLY valid JSON, no markdown fences"""
        response = llm.invoke([("system", "You return JSON only."), ("user", prompt)])
        text = response.content.strip()
        text = re.sub(r'^```json\s*', '', text)
        text = re.sub(r'\s*```$', '', text)
        parsed = json.loads(text)
        parsed.setdefault('title', title)
        parsed.setdefault('summary', '')
        parsed.setdefault('sections', [])
        parsed.setdefault('key_concepts', [])
        parsed.setdefault('learning_objectives', [])
        parsed.setdefault('vocabulary', [])
        return _template_postprocess(parsed, vark_mode, sen_profile, template_id)
    except Exception as e:
        logger.warning("Groq lesson generation failed, trying Gemini: %s", e)
        gem = _gemini_lesson(raw_text, title, topic, source_type, vark_mode, sen_profile, template_id)
        if gem:
            return gem
        base = web_lesson.structure_lesson(raw_text, title=title, topic=topic)
        return _template_postprocess(base, vark_mode, sen_profile, template_id)


def _resolve_user_template(user_id: str) -> tuple[str, str, str]:
    """Look up the student's active template (vark_mode, sen_profile, template_id).
    Reads the digital-twin profile when the backend DB is reachable; falls back to defaults."""
    try:
        from ..core import store
        twin = store.load(user_id)
        if twin:
            vark = twin.get('vark') or {}
            scores = {k: float(vark.get(k, 0) or 0) for k in ('visual', 'auditory', 'reading', 'kinesthetic')}
            mode = max(scores, key=scores.get) if any(v > 0 for v in scores.values()) else 'visual'
            profile = twin.get('sen_profile') or 'general'
        else:
            mode, profile = 'visual', 'general'
    except Exception:
        mode, profile = 'visual', 'general'
    template_id = _pick_template_id(mode, profile)
    return mode, profile, template_id


def _pick_template_id(mode: str, profile: str) -> str:
    """Mirror of the frontend pickTemplateId (SEN overlay is the primary switch)."""
    if profile == 'focus':
        return 'T1'
    if profile == 'text':
        if mode == 'auditory':
            return 'T2'
        if mode == 'reading':
            return 'T4'
        return 'T5'
    if profile == 'structure':
        if mode in ('visual', 'kinesthetic'):
            return 'T3'
        return 'T6'
    return {'kinesthetic': 'T1', 'auditory': 'T2', 'visual': 'T3', 'reading': 'T4'}.get(mode, 'T3')


def _validate_source(user_id: str, subject: str, source_id: str | None,
                     expected_type: str, *, url: str = '', pdf_session_id: str = '') -> dict:
    """Resolve one source from the student's saved profile.

    This is the server-side boundary that prevents a selected course from
    accidentally borrowing another course's material.  Legacy/direct API use
    remains possible only for profiles that do not yet have a source registry.
    """
    from ..core import store
    twin = store.load(user_id) or {}
    sources = twin.get('data_sources', []) or []
    subjects = {str(item.get('name', '')).strip() for item in twin.get('subjects', []) or []}

    # If no profile data exists, allow generation with empty source
    if not subjects and not sources:
        return {}

    # If user has subjects defined, validate the subject
    if subjects and subject and subject not in subjects:
        # Don't raise — allow any subject for simplicity; just warn via log
        pass

    # If no sources exist, allow generation without source validation
    if not sources:
        return {}

    # If source_id is provided, validate it
    if source_id:
        source = next((item for item in sources if str(item.get('id')) == str(source_id)), None)
        if not source:
            # Source not found — fall back to empty source
            return {}
        if source.get('subject', '') and subject and source.get('subject', '') != subject:
            return {}
        if source.get('type') != expected_type:
            return {}
        if url and source.get('url') and source['url'] != url:
            return {}
        if pdf_session_id and source.get('sessionId') != pdf_session_id:
            return {}
        return source

    # No source_id — try to find a matching source by type
    matching = [s for s in sources if s.get('type') == expected_type]
    if matching:
        return matching[0]

    # No matching source found — allow generation with empty source
    return {}


def _attach_provenance(lesson: dict, source: dict, subject: str, course_id: str | None) -> None:
    """Persist immutable course/source identity with every playable lesson."""
    lesson['subject'] = subject
    lesson['course_id'] = course_id or subject
    lesson['source_id'] = str(source.get('id', ''))
    lesson['source_name'] = source.get('name', '')


def _require_source_material(text: str) -> str:
    """Do not let a sparse/broken upload turn into an invented lesson."""
    cleaned = (text or '').strip()
    if len(cleaned.split()) < 20:
        raise ValueError(
            'This source does not contain enough readable material for an accurate lesson. '
            'Upload a fuller source or choose another one.'
        )
    return cleaned


def generate_from_url(url: str, title: str = '', topic: str = '', subject: str = '',
                      user_id: str = 'default', source_id: str | None = None,
                      course_id: str | None = None) -> dict:
    source = _validate_source(user_id, subject, source_id, 'url', url=url)
    raw = web_lesson.fetch_url_content(url)
    _require_source_material(raw['text'])
    vark_mode, sen_profile, template_id = _resolve_user_template(user_id)
    lesson = _groq_lesson(raw['text'], title=raw.get('title', title), topic=topic, source_type='url',
                          vark_mode=vark_mode, sen_profile=sen_profile, template_id=template_id)
    lesson['source_type'] = 'url'
    lesson['source_url'] = url
    lesson['word_count'] = raw.get('word_count', 0)
    _attach_provenance(lesson, source, subject, course_id)
    session_id = _save_lesson(user_id, lesson)
    lesson['session_id'] = session_id
    return lesson


def generate_from_pdf(pdf_bytes: bytes, filename: str, subject: str = '', user_id: str = 'default',
                      source_id: str | None = None, course_id: str | None = None) -> dict:
    source = _validate_source(user_id, subject, source_id, 'pdf')
    from .pdf_rag import extract_text_from_pdf
    text, page_count = extract_text_from_pdf(pdf_bytes)
    _require_source_material(text)
    vark_mode, sen_profile, template_id = _resolve_user_template(user_id)
    lesson = _groq_lesson(text, title=filename, topic=subject, source_type='pdf',
                          vark_mode=vark_mode, sen_profile=sen_profile, template_id=template_id)
    lesson['source_type'] = 'pdf'
    lesson['filename'] = filename
    lesson['page_count'] = page_count
    lesson['word_count'] = len(text.split())
    _attach_provenance(lesson, source, subject, course_id)
    session_id = _save_lesson(user_id, lesson)
    lesson['session_id'] = session_id
    return lesson


def generate_from_pdf_session(pdf_session_id: str, filename: str = '', subject: str = '', user_id: str = 'default',
                              source_id: str | None = None, course_id: str | None = None) -> dict:
    source = _validate_source(user_id, subject, source_id, 'pdf', pdf_session_id=pdf_session_id)
    import os as _os
    import re as _re
    from . import pdf_rag as _pdf_rag
    base = _os.path.join(_os.path.dirname(__file__), '..', '..', 'storage', 'pdf_rag')
    safe_id = _re.sub(r'[^a-zA-Z0-9_\-]', '_', (pdf_session_id or '').strip())
    chunks_file = _os.path.join(base, safe_id, 'chunks.json')
    if not _os.path.exists(chunks_file) and filename:
        # The browser held a session id this backend cannot resolve (restart,
        # migrated storage, or a split-brain backend). Recover by filename.
        recovered = _pdf_rag.find_session_by_filename(filename, user_id=user_id)
        if recovered:
            safe_id = _re.sub(r'[^a-zA-Z0-9_\-]', '_', recovered)
            chunks_file = _os.path.join(base, safe_id, 'chunks.json')
            pdf_session_id = recovered
    if not _os.path.exists(chunks_file):
        return {'error': 'PDF session not found. Please re-upload the PDF.', 'title': filename}
    with open(chunks_file, 'r', encoding='utf-8') as f:
        chunks = json.load(f)
    text = '\n\n'.join([c.get('text', '') for c in chunks[:20]])
    _require_source_material(text)
    vark_mode, sen_profile, template_id = _resolve_user_template(user_id)
    lesson = _groq_lesson(text, title=filename or 'PDF Lesson', topic=subject, source_type='pdf',
                          vark_mode=vark_mode, sen_profile=sen_profile, template_id=template_id)
    lesson['source_type'] = 'pdf'
    lesson['filename'] = filename
    lesson['pdf_session_id'] = pdf_session_id
    lesson['word_count'] = len(text.split())
    _attach_provenance(lesson, source, subject, course_id)
    session_id = _save_lesson(user_id, lesson)
    lesson['session_id'] = session_id
    return lesson


def generate_from_text(raw_text: str, title: str = '', topic: str = '', subject: str = '', user_id: str = 'default',
                       source_id: str | None = None, course_id: str | None = None) -> dict:
    source = _validate_source(user_id, subject, source_id, 'text')
    raw_text = _require_source_material(raw_text)
    vark_mode, sen_profile, template_id = _resolve_user_template(user_id)
    lesson = _groq_lesson(raw_text, title=title, topic=topic or subject, source_type='text',
                          vark_mode=vark_mode, sen_profile=sen_profile, template_id=template_id)
    lesson['source_type'] = 'text'
    lesson['word_count'] = len(raw_text.split())
    _attach_provenance(lesson, source, subject, course_id)
    session_id = _save_lesson(user_id, lesson)
    lesson['session_id'] = session_id
    return lesson


def generate_from_moodle_course(course_name: str, files: list[dict], subject: str = '', user_id: str = 'default',
                                source_id: str | None = None, course_id: str | None = None) -> dict:
    source = _validate_source(user_id, subject, source_id, 'moodle')
    combined_text = ''
    for f in files[:10]:
        if f.get('content'):
            combined_text += f['content'] + '\n\n'
    if not combined_text.strip():
        raise ValueError('This Moodle course has no synced readable material yet.')
    combined_text = _require_source_material(combined_text)
    vark_mode, sen_profile, template_id = _resolve_user_template(user_id)
    lesson = _groq_lesson(combined_text, title=course_name, topic=subject, source_type='moodle',
                          vark_mode=vark_mode, sen_profile=sen_profile, template_id=template_id)
    lesson['source_type'] = 'moodle'
    lesson['file_count'] = len(files)
    lesson['word_count'] = len(combined_text.split())
    _attach_provenance(lesson, source, subject, course_id)
    session_id = _save_lesson(user_id, lesson)
    lesson['session_id'] = session_id
    return lesson


def list_user_lessons(user_id: str = 'default') -> list[dict]:
    lessons = []
    user_dir = os.path.join(STORAGE_DIR, user_id)
    if not os.path.exists(user_dir):
        return lessons
    for fname in os.listdir(user_dir):
        if fname.endswith('.json'):
            try:
                with open(os.path.join(user_dir, fname), 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    lessons.append({
                        'session_id': data.get('session_id', fname.replace('.json', '')),
                        'title': data.get('title', 'Untitled'),
                        'summary': data.get('summary', ''),
                        'source_type': data.get('source_type', 'unknown'),
                        'subject': data.get('subject', ''),
                        'source_id': data.get('source_id', ''),
                        'course_id': data.get('course_id', ''),
                        'word_count': data.get('word_count', 0),
                        'created_at': data.get('created_at', ''),
                    })
            except Exception:
                pass
    lessons.sort(key=lambda x: x.get('created_at', ''), reverse=True)
    return lessons


def get_lesson(session_id: str, user_id: str = 'default') -> dict | None:
    path = os.path.join(STORAGE_DIR, user_id, f'{session_id}.json')
    if not os.path.exists(path):
        return None
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        # Truncated/empty lesson file (hard kill mid-write) — hide it rather
        # than 500-ing the detail and list endpoints.
        return None


def _save_lesson(user_id: str, lesson_data: dict) -> str:
    from datetime import datetime
    # Titles are not identifiers: two sources can share one. A random ID keeps
    # lesson playback and its source provenance immutable and collision-free.
    session_id = f"{user_id}_{uuid.uuid4().hex[:12]}"
    lesson_data['session_id'] = session_id
    lesson_data['created_at'] = datetime.utcnow().isoformat()
    user_dir = os.path.join(STORAGE_DIR, user_id)
    os.makedirs(user_dir, exist_ok=True)
    path = os.path.join(user_dir, f'{session_id}.json')
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(lesson_data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)
    return session_id
