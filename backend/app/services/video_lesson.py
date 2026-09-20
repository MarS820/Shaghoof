from __future__ import annotations
import json
import logging
import os
import hashlib

logger = logging.getLogger(__name__)


STORAGE_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'storage', 'video_lessons')
os.makedirs(STORAGE_DIR, exist_ok=True)


def _template_video_shape(template_id: str, scene: dict, index: int, sen_profile: str) -> None:
    """Per-template video styling so each template produces a recognizably
    different video (mirrors the lesson-template directives)."""
    scene['template_id'] = template_id
    if template_id == 'T1':  # Sandbox: quick quest cards
        scene['style'] = 'quest_card'
        scene['accent'] = '#F97316'
    elif template_id == 'T2':  # Podcast: waveform + transcript strip
        scene['style'] = 'podcast'
        scene['accent'] = '#8B5CF6'
        scene['show_transcript'] = True
    elif template_id == 'T3':  # Storyboard: calm scene cards
        scene['style'] = 'storyboard'
        scene['accent'] = '#3B82F6'
        scene['transition'] = 'fade_in'
    elif template_id == 'T5':  # Explorer: diagram-forward
        scene['style'] = 'explorer'
        scene['accent'] = '#10B981'
    elif template_id == 'T6':  # Routine: step timeline
        scene['style'] = 'routine'
        scene['accent'] = '#0EA5E9'
        scene['show_step_counter'] = True
        scene['step_number'] = index + 1
    if sen_profile == 'focus':
        scene['max_bubbles'] = 2
    if sen_profile == 'structure':
        scene['transition'] = 'fade_in'  # calm, no slides


def generate_video_script(
    lesson: dict,
    duration_minutes: int = 5,
    vark_mode: str = 'visual',
    sen_profile: str = 'general',
    template_id: str = 'T3',
    ai_clips: bool = False,
) -> dict:
    """Generate a video lesson script from a structured lesson.

    Returns a dict with scenes, narration, visual cues, and timing.
    When ai_clips is enabled and REPLICATE_API_TOKEN is set, each content scene
    also gets a short AI-generated video clip (LTX-Video) generated from a
    template-adapted visual prompt.
    """
    sections = lesson.get('sections', [])
    title = lesson.get('title', 'Lesson')
    summary = lesson.get('summary', '')
    concepts = lesson.get('key_concepts', [])

    scenes = []
    elapsed = 0
    target_seconds = duration_minutes * 60

    intro_seconds = min(30, target_seconds // 8)
    scenes.append({
        'scene': 1,
        'type': 'intro',
        'duration_seconds': intro_seconds,
        'narration': f"Welcome to {title}. {' '.join(summary.split()[:30])}..." if summary else f"Welcome to {title}.",
        'visual': 'mascot_wave',
        'text_overlay': title,
        'transition': 'fade_in',
    })
    elapsed += intro_seconds

    content_sections = [s for s in sections if s.get('type') == 'paragraph']
    heading_sections = [s for s in sections if s.get('type') in ('heading', 'subheading')]

    per_scene = max(15, (target_seconds - elapsed - 30) // max(1, len(content_sections[:8])))

    scene_num = 2
    for i, section in enumerate(content_sections[:8]):
        if elapsed >= target_seconds - 30:
            break

        text = section.get('text', '')
        words = text.split()
        narration = ' '.join(words[:40])
        if len(words) > 40:
            narration += '...'

        scene = {
            'scene': scene_num,
            'type': 'content',
            'duration_seconds': min(per_scene, target_seconds - elapsed - 15),
            'narration': narration,
            'visual': _visual_cue_for_index(i, vark_mode),
            'text_overlay': text[:100] + ('...' if len(text) > 100 else ''),
            'transition': 'slide_left' if i % 2 == 0 else 'slide_right',
        }

        if sen_profile == 'focus' and i % 2 == 0:
            scene['pause_after'] = True
            scene['pause_seconds'] = 2
        if sen_profile == 'structure':
            scene['step_number'] = i + 1
            scene['show_step_counter'] = True
        if sen_profile == 'text':
            scene['text_overlay'] = text[:60] + '...'
            scene['highlight_keywords'] = True

        scenes.append(scene)
        _template_video_shape(template_id, scene, i, sen_profile)
        if ai_clips:
            # Optional AI-generated motion clip (LTX-Video via Replicate).
            clip_url = _ai_clip_for_scene(title, text, vark_mode)
            if clip_url:
                scene['ai_clip_url'] = clip_url
        elapsed += scene['duration_seconds']
        scene_num += 1

    if concepts and elapsed < target_seconds - 15:
        concept_text = ', '.join([c.get('text', c) if isinstance(c, dict) else str(c) for c in concepts[:4]])
        scenes.append({
            'scene': scene_num,
            'type': 'review',
            'duration_seconds': min(30, target_seconds - elapsed),
            'narration': f"Let's review the key concepts: {concept_text}.",
            'visual': 'concept_grid',
            'text_overlay': 'Key Concepts',
            'transition': 'fade_in',
            'show_concepts': [c.get('text', c) if isinstance(c, dict) else str(c) for c in concepts[:4]],
        })
        elapsed += scenes[-1]['duration_seconds']
        scene_num += 1

    outro_seconds = min(20, target_seconds - elapsed)
    if outro_seconds > 5:
        encouragement = _encouragement_for_profile(sen_profile)
        scenes.append({
            'scene': scene_num,
            'type': 'outro',
            'duration_seconds': outro_seconds,
            'narration': f"{encouragement} Great job completing this lesson!",
            'visual': 'mascot_celebrate',
            'text_overlay': 'Great job!',
            'transition': 'fade_out',
        })

    total_duration = sum(s['duration_seconds'] for s in scenes)

    return {
        'title': title,
        'total_duration_seconds': total_duration,
        'total_duration_label': f"{total_duration // 60}:{total_duration % 60:02d}",
        'scene_count': len(scenes),
        'vark_mode': vark_mode,
        'sen_profile': sen_profile,
        'template_id': template_id,
        'scenes': scenes,
        'status': 'generated',
    }


def _ai_clip_for_scene(lesson_title: str, scene_text: str, vark_mode: str) -> str | None:
    """Generate a short AI video clip for a scene using LTX-Video on Replicate.

    LTX-Video is a small, real-time DiT text-to-video model (~$0.019/clip on
    Replicate), ideal for 5-second educational b-roll. Returns None when no
    REPLICATE_API_TOKEN is configured or generation fails — the canvas player
    then renders its built-in template-styled scene instead.
    """
    token = os.getenv("REPLICATE_API_TOKEN", "")
    if not token:
        return None
    try:
        import requests
        style_by_mode = {
            'visual': 'clean flat vector illustration style, educational diagram animation',
            'auditory': 'soft abstract visualization of sound waves and rhythm, educational',
            'reading': 'minimal typographic motion design, book pages turning, educational',
            'kinesthetic': 'hands-on demonstration, objects moving, practical educational demo',
        }
        prompt = (
            f"Educational video about {lesson_title}: {_shorten(scene_text, 160)}. "
            f"{style_by_mode.get(vark_mode, style_by_mode['visual'])}. "
            "Bright friendly colors, smooth motion, no text overlays."
        )
        resp = requests.post(
            "https://api.replicate.com/v1/models/lightricks/ltx-video/predictions",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={
                "input": {
                    "prompt": prompt,
                    "duration": 5,
                    "resolution": "480p",
                }
            },
            timeout=20,
        )
        resp.raise_for_status()
        pred = resp.json()
        pred_url = pred.get("urls", {}).get("get")
        if not pred_url:
            return None
        # Poll briefly (model is near real-time but the queue adds latency).
        import time
        for _ in range(24):
            time.sleep(5)
            poll = requests.get(pred_url, headers={"Authorization": f"Bearer {token}"}, timeout=15)
            data = poll.json()
            if data.get("status") == "succeeded":
                output = data.get("output")
                if isinstance(output, str):
                    return output
                if isinstance(output, list) and output:
                    return str(output[-1])
                return None
            if data.get("status") in ("failed", "canceled"):
                return None
        return None
    except Exception as exc:
        logger.warning("AI clip generation failed (falling back to canvas scene): %s", exc)
        return None


def _shorten(text: str, n: int) -> str:
    words = str(text or '').split()
    return ' '.join(words[:n])


def _visual_cue_for_index(index: int, vark_mode: str) -> str:
    cues = {
        'visual': ['diagram', 'animation', 'illustration', 'chart', 'infographic', 'mind_map', 'flowchart', 'picture'],
        'auditory': ['waveform', 'speaker_icon', 'podcast_visual', 'sound_wave', 'music_note', 'headphones', 'microphone', 'audio_spectrum'],
        'reading': ['text_highlight', 'book_page', 'definition_card', 'notebook', 'pencil', 'paragraph', 'glossary', 'checklist'],
        'kinesthetic': ['interactive_demo', 'drag_drop', 'step_by_step', 'hands_on', 'experiment', 'build_it', 'try_it', 'explore'],
    }
    style_cues = cues.get(vark_mode, cues['visual'])
    return style_cues[index % len(style_cues)]


def _encouragement_for_profile(profile: str) -> str:
    encouragements = {
        'general': 'Well done!',
        'text': 'Great reading!',
        'focus': 'Amazing focus!',
        'structure': 'Perfect completion!',
    }
    return encouragements.get(profile, 'Well done!')


def save_video_lesson(user_id: str, video_data: dict) -> str:
    content_hash = hashlib.md5(video_data.get('title', '').encode()).hexdigest()[:10]
    session_id = f"vid_{user_id}_{content_hash}"
    path = os.path.join(STORAGE_DIR, f'{session_id}.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(video_data, f, ensure_ascii=False, indent=2)
    return session_id
