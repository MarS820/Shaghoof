"""Wordwall oEmbed Integration Service.

This service handles embedding Wordwall activities into lessons by:
1. Fetching oEmbed data from Wordwall's API
2. Validating Wordwall resource URLs
3. Providing embed HTML for lesson integration
4. Mapping Wordwall activity types to our template system

Wordwall URL schemes supported:
- https://wordwall.net/resource/* (resource pages)
- https://wordwall.net/play/* (direct play links)

API endpoint:
- https://wordwall.net/api/oembed?url={resource_url}&format=json
"""

from __future__ import annotations

import re
import logging
from typing import Optional
from urllib.parse import quote

logger = logging.getLogger(__name__)

try:
    import httpx
except ImportError:
    httpx = None

# Wordwall URL patterns
RESOURCE_PATTERN = re.compile(r'https?://wordwall\.net/resource/(\d+)(?:/[^?]*)?')
PLAY_PATTERN = re.compile(r'https?://wordwall\.net/play/([a-f0-9]+)(?:\?.*)?')
EMBED_PATTERN = re.compile(r'https?://wordwall\.net/embed/([a-f0-9]+)(?:\?.*)?')

# Wordwall activity types mapped to our template system
WORDWALL_ACTIVITY_MAP = {
    # Matching games → T1 (kinesthetic/focus)
    'match': {'template': 'T1', 'label_en': 'Match Up', 'label_ar': 'مطابقة'},
    'matching': {'template': 'T1', 'label_en': 'Matching Pairs', 'label_ar': 'أزواج متطابقة'},
    
    # True/False → T2 (auditory/text)
    'truefalse': {'template': 'T2', 'label_en': 'True or False', 'label_ar': 'صح أم خطأ'},
    'true-false': {'template': 'T2', 'label_en': 'True or False', 'label_ar': 'صح أم خطأ'},
    
    # Quizzes → T3 (visual/structure)
    'quiz': {'template': 'T3', 'label_en': 'Quiz', 'label_ar': 'اختبار'},
    'multiplechoice': {'template': 'T3', 'label_en': 'Multiple Choice', 'label_ar': 'اختيار متعدد'},
    
    # Word games → T4 (reading/text)
    'wordsearch': {'template': 'T4', 'label_en': 'Word Search', 'label_ar': 'بحث عن كلمات'},
    'crossword': {'template': 'T4', 'label_en': 'Crossword', 'label_ar': 'كROSSword'},
    'anagram': {'template': 'T4', 'label_en': 'Anagram', 'label_ar': 'تشفير حروف'},
    
    # Wheel/Random → T5 (visual/kinesthetic)
    'wheel': {'template': 'T5', 'label_en': 'Spin the Wheel', 'label_ar': 'عجلة الدوران'},
    'randomwheel': {'template': 'T5', 'label_en': 'Random Wheel', 'label_ar': 'عجلة عشوائية'},
    
    # Sorting/Ordering → T6 (structure)
    'groupsort': {'template': 'T6', 'label_en': 'Group Sort', 'label_ar': 'تصنيف المجموعات'},
    'ranking': {'template': 'T6', 'label_en': 'Ranking', 'label_ar': 'ترتيب'},
    'labelleddiagram': {'template': 'T6', 'label_en': 'Labelled Diagram', 'label_ar': 'رسم مُعلَّم'},
    
    # Flashcards (any template)
    'flashcards': {'template': 'any', 'label_en': 'Flashcards', 'label_ar': 'بطاقات تعليمية'},
    
    # Type answer (reading focused)
    'typeanswer': {'template': 'T4', 'label_en': 'Type the Answer', 'label_ar': 'اكتب الإجابة'},
    
    # Airplane (kinesthetic)
    'airplane': {'template': 'T1', 'label_en': 'Airplane', 'label_ar': 'طائرة'},
    
    # Unjumble (structure)
    'unjumble': {'template': 'T6', 'label_en': 'Unjumble', 'label_ar': 'ترتيب الكلمات'},
}


class WordwallEmbedError(Exception):
    """Custom exception for Wordwall embed errors."""
    pass


def validate_wordwall_url(url: str) -> tuple[bool, str, Optional[str]]:
    """Validate a Wordwall URL and extract the resource ID.
    
    Returns:
        (is_valid, url_type, resource_id)
    """
    if not url:
        return False, 'invalid', None
    
    url = url.strip()
    
    # Check for resource URL
    match = RESOURCE_PATTERN.match(url)
    if match:
        return True, 'resource', match.group(1)
    
    # Check for play URL
    match = PLAY_PATTERN.match(url)
    if match:
        return True, 'play', match.group(1)
    
    # Check for embed URL
    match = EMBED_PATTERN.match(url)
    if match:
        return True, 'embed', match.group(1)
    
    return False, 'invalid', None


async def fetch_oembed_data(url: str) -> dict:
    """Fetch oEmbed data from Wordwall API.
    
    Args:
        url: Wordwall resource or play URL
        
    Returns:
        Dictionary with oEmbed data including html, title, thumbnail_url
        
    Raises:
        WordwallEmbedError: If fetching fails or URL is invalid
    """
    is_valid, url_type, resource_id = validate_wordwall_url(url)
    if not is_valid:
        raise WordwallEmbedError(f"Invalid Wordwall URL: {url}")
    
    # Construct oEmbed API URL
    oembed_url = f"https://wordwall.net/api/oembed?url={quote(url, safe='')}&format=json"
    
    if httpx is None:
        raise WordwallEmbedError("httpx library not installed. Run: pip install httpx")
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(oembed_url)
            response.raise_for_status()
            data = response.json()
            
            # Validate response structure
            required_fields = ['html', 'title', 'thumbnail_url']
            for field in required_fields:
                if field not in data:
                    raise WordwallEmbedError(f"Missing field in oEmbed response: {field}")
            
            # Extract embed URL from HTML if available
            embed_url = None
            if 'html' in data:
                src_match = re.search(r'src="([^"]+)"', data['html'])
                if src_match:
                    embed_url = src_match.group(1)
            
            return {
                'valid': True,
                'url_type': url_type,
                'resource_id': resource_id,
                'title': data.get('title', ''),
                'html': data.get('html', ''),
                'embed_url': embed_url,
                'thumbnail_url': data.get('thumbnail_url', ''),
                'thumbnail_width': data.get('thumbnail_width', 800),
                'thumbnail_height': data.get('thumbnail_height', 600),
                'author_name': data.get('author_name', ''),
                'author_url': data.get('author_url', ''),
                'provider_name': data.get('provider_name', 'Wordwall'),
                'provider_url': data.get('provider_url', 'https://wordwall.net'),
                'width': data.get('width', 500),
                'height': data.get('height', 380),
            }
            
    except httpx.HTTPStatusError as e:
        raise WordwallEmbedError(f"HTTP error fetching oEmbed data: {e.response.status_code}")
    except httpx.RequestError as e:
        raise WordwallEmbedError(f"Network error fetching oEmbed data: {str(e)}")
    except Exception as e:
        raise WordwallEmbedError(f"Unexpected error fetching oEmbed data: {str(e)}")


def create_embed_package(oembed_data: dict, template_id: str = None) -> dict:
    """Create a complete embed package for lesson integration.
    
    Args:
        oembed_data: Data from fetch_oembed_data
        template_id: Optional template ID to associate with
        
    Returns:
        Dictionary with embed package for frontend
    """
    if not oembed_data.get('valid'):
        return {'valid': False, 'error': 'Invalid oEmbed data'}
    
    # Determine best template based on URL or fallback to provided
    template = template_id or 'T3'
    
    return {
        'valid': True,
        'type': 'wordwall_embed',
        'template_id': template,
        'resource_id': oembed_data.get('resource_id'),
        'title': oembed_data.get('title', 'Wordwall Activity'),
        'html': oembed_data.get('html', ''),
        'embed_url': oembed_data.get('embed_url'),
        'thumbnail_url': oembed_data.get('thumbnail_url', ''),
        'author': oembed_data.get('author_name', ''),
        'author_url': oembed_data.get('author_url', ''),
        'width': oembed_data.get('width', 500),
        'height': oembed_data.get('height', 380),
        'provider': 'Wordwall',
    }


def create_lesson_wordwall_section(lesson: dict, wordwall_urls: list[str] = None) -> dict:
    """Create a Wordwall section for a lesson with embedded activities.
    
    Args:
        lesson: Lesson data dictionary
        wordwall_urls: Optional list of Wordwall resource URLs to embed
        
    Returns:
        Dictionary with Wordwall section data
    """
    template_id = lesson.get('template_id', 'T3')
    
    section = {
        'type': 'wordwall',
        'template_id': template_id,
        'activities': [],
        'generated_games': [],
    }
    
    # Add embedded Wordwall activities if provided
    if wordwall_urls:
        for url in wordwall_urls:
            is_valid, url_type, resource_id = validate_wordwall_url(url)
            if is_valid:
                section['activities'].append({
                    'url': url,
                    'url_type': url_type,
                    'resource_id': resource_id,
                    'status': 'pending_embed',  # Will be resolved by frontend
                })
    
    # Add reference to generated game pack if exists
    if 'wordwall' in lesson:
        pack = lesson['wordwall']
        if pack:
            section['generated_games'].append({
                'kind': pack.get('kind', 'unknown'),
                'title': pack.get('title', 'Game'),
                'template_id': pack.get('template_id', template_id),
            })
    
    return section


def get_wordwall_template_suggestions(topic: str, subject: str = '') -> list[dict]:
    """Get suggested Wordwall activity types for a topic/subject.
    
    This provides recommendations for which Wordwall activity types
    work best for different subjects and topics.
    
    Args:
        topic: Lesson topic
        subject: Optional subject category
        
    Returns:
        List of suggested activity types with descriptions
    """
    suggestions = []
    
    # Subject-based suggestions
    subject_lower = subject.lower() if subject else ''
    topic_lower = topic.lower() if topic else ''
    
    if any(word in subject_lower for word in ['science', 'biology', 'chemistry', 'physics']):
        suggestions.extend([
            {'type': 'labelleddiagram', 'reason': 'Visual learners benefit from labelling diagrams'},
            {'type': 'matching', 'reason': 'Match terms with definitions for vocabulary building'},
            {'type': 'quiz', 'reason': 'Test understanding of scientific concepts'},
        ])
    elif any(word in subject_lower for word in ['math', 'algebra', 'geometry']):
        suggestions.extend([
            {'type': 'typeanswer', 'reason': 'Practice solving equations and problems'},
            {'type': 'match', 'reason': 'Match formulas with their names'},
            {'type': 'ranking', 'reason': 'Order mathematical operations or steps'},
        ])
    elif any(word in subject_lower for word in ['language', 'english', 'arabic', 'grammar']):
        suggestions.extend([
            {'type': 'wordsearch', 'reason': 'Build vocabulary through word discovery'},
            {'type': 'anagram', 'reason': 'Practice spelling and word formation'},
            {'type': 'crossword', 'reason': 'Reinforce vocabulary through clues'},
        ])
    elif any(word in subject_lower for word in ['history', 'social', 'geography']):
        suggestions.extend([
            {'type': 'ranking', 'reason': 'Order historical events chronologically'},
            {'type': 'groupsort', 'reason': 'Categorize historical figures or events'},
            {'type': 'quiz', 'reason': 'Test knowledge of historical facts'},
        ])
    else:
        # General suggestions
        suggestions.extend([
            {'type': 'match', 'reason': 'Universal format for vocabulary building'},
            {'type': 'quiz', 'reason': 'Test understanding of any topic'},
            {'type': 'wheel', 'reason': 'Engaging random selection for review'},
        ])
    
    # VARK-based suggestions
    if 'visual' in topic_lower or 'diagram' in topic_lower:
        suggestions.insert(0, {'type': 'labelleddiagram', 'reason': 'Perfect for visual learning'})
    elif 'listen' in topic_lower or 'audio' in topic_lower:
        suggestions.insert(0, {'type': 'truefalse', 'reason': 'Good for auditory processing'})
    elif 'read' in topic_lower or 'write' in topic_lower:
        suggestions.insert(0, {'type': 'crossword', 'reason': 'Excellent for reading/writing practice'})
    elif 'hands' in topic_lower or 'activity' in topic_lower:
        suggestions.insert(0, {'type': 'match', 'reason': 'Interactive kinesthetic activity'})
    
    return suggestions[:5]  # Return top 5 suggestions


def extract_wordwall_urls_from_lesson(lesson: dict) -> list[str]:
    """Extract any Wordwall URLs already present in lesson content.
    
    Args:
        lesson: Lesson data dictionary
        
    Returns:
        List of found Wordwall URLs
    """
    urls = []
    
    # Check sections for URLs
    for section in lesson.get('sections', []):
        text = section.get('text', '')
        # Find Wordwall URLs in text
        found = re.findall(r'https?://wordwall\.net/(?:resource|play|embed)/[^\s<>"\']+', text)
        urls.extend(found)
    
    # Check for explicit wordwall_urls field
    if 'wordwall_urls' in lesson:
        urls.extend(lesson['wordwall_urls'])
    
    # Check for wordwall activities in presentation
    presentation = lesson.get('presentation', {})
    if 'wordwall' in presentation:
        activities = presentation['wordwall']
        if isinstance(activities, list):
            for activity in activities:
                if isinstance(activity, dict) and 'url' in activity:
                    urls.append(activity['url'])
                elif isinstance(activity, str):
                    urls.append(activity)
    
    # Deduplicate while preserving order
    seen = set()
    unique_urls = []
    for url in urls:
        if url not in seen:
            seen.add(url)
            unique_urls.append(url)
    
    return unique_urls
