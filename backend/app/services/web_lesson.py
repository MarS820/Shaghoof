from __future__ import annotations
import hashlib
import json
import os
import re
import requests
from urllib.parse import urlparse, urljoin
from html.parser import HTMLParser


STORAGE_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'storage', 'web_lessons')
os.makedirs(STORAGE_DIR, exist_ok=True)


class _TextExtractor(HTMLParser):
    """Extract readable text from HTML, stripping scripts/styles/nav."""

    SKIP = {'script', 'style', 'nav', 'footer', 'header', 'aside', 'noscript', 'iframe', 'form'}

    def __init__(self):
        super().__init__()
        self._parts: list[str] = []
        self._skip_depth = 0
        self._heading_stack: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self._skip_depth += 1
        if tag in ('h1', 'h2', 'h3', 'h4', 'h5', 'h6'):
            self._parts.append(f'\n\n## ')
            self._heading_stack.append(tag)
        if tag == 'p':
            self._parts.append('\n\n')
        if tag == 'li':
            self._parts.append('\n- ')
        if tag == 'br':
            self._parts.append('\n')

    def handle_endtag(self, tag):
        if tag in self.SKIP:
            self._skip_depth = max(0, self._skip_depth - 1)
        if tag in ('h1', 'h2', 'h3', 'h4', 'h5', 'h6'):
            self._parts.append('\n')
            if self._heading_stack:
                self._heading_stack.pop()
        if tag == 'p':
            self._parts.append('\n')

    def handle_data(self, data):
        if self._skip_depth == 0:
            self._parts.append(data)

    def get_text(self) -> str:
        raw = ''.join(self._parts)
        lines = [line.strip() for line in raw.split('\n')]
        return '\n'.join(lines)


def _clean_text(text: str) -> str:
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'[ \t]+', ' ', text)
    return text.strip()


def fetch_url_content(url: str, timeout: int = 15) -> dict:
    """Fetch a URL and extract readable text content."""
    parsed = urlparse(url)
    if parsed.scheme not in ('http', 'https'):
        raise ValueError('Only http/https URLs are supported')

    headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; ShaghoofBot/1.0; Educational)',
        'Accept': 'text/html,application/xhtml+xml',
    }
    resp = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True)
    resp.raise_for_status()

    content_type = resp.headers.get('Content-Type', '')
    html = resp.text

    extractor = _TextExtractor()
    try:
        extractor.feed(html)
    except Exception:
        pass

    raw_text = extractor.get_text()
    cleaned = _clean_text(raw_text)

    if len(cleaned) < 50:
        title_match = re.search(r'<title[^>]*>([^<]+)</title>', html, re.IGNORECASE)
        title = title_match.group(1).strip() if title_match else parsed.netloc
        return {
            'url': url,
            'title': title,
            'text': cleaned or f'Could not extract meaningful content from {url}',
            'word_count': len(cleaned.split()),
            'status': 'minimal_content',
        }

    title_match = re.search(r'<title[^>]*>([^<]+)</title>', html, re.IGNORECASE)
    title = title_match.group(1).strip() if title_match else parsed.netloc

    return {
        'url': url,
        'title': title,
        'text': cleaned,
        'word_count': len(cleaned.split()),
        'status': 'ok',
    }


def structure_lesson(raw_text: str, title: str = '', topic: str = '') -> dict:
    """Break raw extracted text into structured lesson sections."""
    paragraphs = [p.strip() for p in raw_text.split('\n\n') if len(p.strip()) > 20]

    sections = []
    for i, para in enumerate(paragraphs[:20]):
        is_heading = para.startswith('## ')
        clean = para.lstrip('#').strip()
        if is_heading:
            sections.append({'type': 'heading', 'text': clean})
        elif len(clean) < 80 and i > 0:
            sections.append({'type': 'subheading', 'text': clean})
        else:
            sections.append({'type': 'paragraph', 'text': clean})

    key_concepts = []
    for p in paragraphs[:10]:
        sentences = re.split(r'[.!?]+', p)
        for s in sentences:
            s = s.strip()
            if 20 < len(s) < 120 and any(kw in s.lower() for kw in ['is', 'are', 'means', 'defined', 'refers', 'called', 'known']):
                key_concepts.append(s.strip())
                if len(key_concepts) >= 5:
                    break
        if len(key_concepts) >= 5:
            break

    summary_text = ' '.join(paragraphs[:3])[:500] if paragraphs else title

    return {
        'title': title or topic or 'Web Lesson',
        'sections': sections,
        'key_concepts': key_concepts,
        'summary': summary_text,
        'total_paragraphs': len(paragraphs),
    }


def save_lesson(user_id: str, lesson_data: dict) -> str:
    """Save a lesson to storage and return session ID."""
    content_hash = hashlib.md5(lesson_data.get('title', '').encode()).hexdigest()[:10]
    session_id = f"{user_id}_{content_hash}"
    path = os.path.join(STORAGE_DIR, f'{session_id}.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(lesson_data, f, ensure_ascii=False, indent=2)
    return session_id


def load_lesson(session_id: str) -> dict | None:
    path = os.path.join(STORAGE_DIR, f'{session_id}.json')
    if not os.path.exists(path):
        return None
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)
