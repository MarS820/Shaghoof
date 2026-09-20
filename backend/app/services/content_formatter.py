from __future__ import annotations


def format_for_lesson(content: dict, vark: dict | None = None, sen_profile: str = 'general', sen_flags: list[str] | None = None) -> dict:
    """Format a lesson's content based on VARK scores and SEN profile.

    Returns the content dict with added presentation hints and adaptations.
    """
    vark = vark or {}
    flags = sen_flags or []
    mode = _dominant_mode(vark)

    formatted = {
        'title': content.get('title', ''),
        'summary': _adapt_summary(content.get('summary', ''), mode, sen_profile, flags),
        'sections': [],
        'key_concepts': content.get('key_concepts', []),
        'presentation': _presentation_hints(mode, sen_profile, flags),
        'vark_mode': mode,
        'sen_profile': sen_profile,
    }

    for section in content.get('sections', []):
        adapted = _adapt_section(section, mode, sen_profile, flags)
        formatted['sections'].append(adapted)

    formatted['key_concepts'] = _adapt_concepts(content.get('key_concepts', []), mode, sen_profile, flags)

    return formatted


def _dominant_mode(vark: dict) -> str:
    if not vark:
        return 'visual'
    scores = {k: vark.get(k, 50) for k in ['visual', 'auditory', 'reading', 'kinesthetic']}
    return max(scores, key=scores.get)


def _adapt_summary(summary: str, mode: str, profile: str, flags: list[str]) -> str:
    if not summary:
        return summary

    if profile == 'text' or any(f in ('dyslexia', 'dyslexic', 'esl') for f in flags):
        sentences = summary.split('. ')
        shortened = '. '.join(sentences[:min(3, len(sentences))])
        words = shortened.split()
        if len(words) > 60:
            shortened = ' '.join(words[:60]) + '...'
        return shortened

    if profile == 'focus' or any(f in ('adhd', 'semh') for f in flags):
        sentences = summary.split('. ')
        return sentences[0] + '.' if sentences else summary

    return summary


def _adapt_section(section: dict, mode: str, profile: str, flags: list[str]) -> dict:
    adapted = dict(section)
    text = adapted.get('text', '')

    if profile == 'structure' or any(f in ('asd', 'autism', 'slcn') for f in flags):
        sentences = [s.strip() for s in text.split('. ') if s.strip()]
        if len(sentences) > 3:
            adapted['text'] = '. '.join(sentences[:3]) + '.'
            adapted['truncated'] = True
            adapted['original_length'] = len(sentences)
        adapted['concrete'] = True

    if profile == 'text' or any(f in ('dyslexia', 'dyslexic', 'esl') for f in flags):
        words = text.split()
        if len(words) > 50:
            adapted['text'] = ' '.join(words[:50]) + '...'
            adapted['truncated'] = True
            adapted['original_length'] = len(words)
        adapted['short_lines'] = True

    if profile == 'focus' or any(f in ('adhd', 'semh') for f in flags):
        sentences = [s.strip() for s in text.split('. ') if s.strip()]
        if len(sentences) > 2:
            adapted['text'] = '. '.join(sentences[:2]) + '.'
            adapted['truncated'] = True

    adapted['display_style'] = _display_style(mode, profile, flags)

    return adapted


def _adapt_concepts(concepts: list[str], mode: str, profile: str, flags: list[str]) -> list[dict]:
    adapted = []
    for c in concepts[:6]:
        item = {'text': c}

        if mode == 'visual':
            item['suggestion'] = 'Look for a diagram or visual representation of this concept.'
            item['icon'] = '👁️'
        elif mode == 'auditory':
            item['suggestion'] = 'Try explaining this concept out loud to someone.'
            item['icon'] = '👂'
        elif mode == 'reading':
            item['suggestion'] = 'Write this concept in your own words.'
            item['icon'] = '📝'
        elif mode == 'kinesthetic':
            item['suggestion'] = 'Try a hands-on activity to understand this concept.'
            item['icon'] = '🖐️'

        if profile == 'text':
            item['suggestion'] = f"Read carefully: {item.get('suggestion', '')}"
        elif profile == 'focus':
            item['suggestion'] = f"One at a time: {item.get('suggestion', '')}"
        elif profile == 'structure':
            item['suggestion'] = f"In order: {item.get('suggestion', '')}"

        adapted.append(item)
    return adapted


def _presentation_hints(mode: str, profile: str, flags: list[str]) -> dict:
    hints = {
        'font_size': 'normal',
        'line_height': 'normal',
        'max_paragraph_words': 100,
        'use_bullet_points': False,
        'audio_available': False,
        'sign_language_hint': False,
        'sensory_reduced': False,
        'step_by_step': False,
        'visual_aids_priority': False,
        'large_text': False,
        'high_contrast': False,
    }

    if mode == 'visual':
        hints['visual_aids_priority'] = True
    elif mode == 'auditory':
        hints['audio_available'] = True
    elif mode == 'reading':
        hints['use_bullet_points'] = True
    elif mode == 'kinesthetic':
        hints['step_by_step'] = True

    if profile == 'text':
        hints['font_size'] = 'large'
        hints['large_text'] = True
        hints['line_height'] = 'wide'
        hints['max_paragraph_words'] = 30
        hints['high_contrast'] = True
    elif profile == 'focus':
        hints['max_paragraph_words'] = 20
        hints['step_by_step'] = True
        hints['sensory_reduced'] = True
    elif profile == 'structure':
        hints['sensory_reduced'] = True
        hints['step_by_step'] = True
        hints['max_paragraph_words'] = 25
        hints['use_bullet_points'] = True

    if any(f in ('blind',) for f in flags):
        hints['audio_available'] = True
        hints['high_contrast'] = True
    if any(f in ('deaf',) for f in flags):
        hints['sign_language_hint'] = True
        hints['visual_aids_priority'] = True
    if any(f in ('dyslexia', 'dyslexic') for f in flags):
        hints['font_size'] = 'large'
        hints['line_height'] = 'wide'
        hints['high_contrast'] = True

    return hints


def _display_style(mode: str, profile: str, flags: list[str]) -> str:
    if profile == 'structure':
        return 'numbered_steps'
    if profile == 'focus':
        return 'micro_sections'
    if profile == 'text':
        return 'clean_text'
    if mode == 'visual':
        return 'visual_cards'
    if mode == 'auditory':
        return 'audio_friendly'
    if mode == 'kinesthetic':
        return 'interactive_steps'
    return 'standard'
