"""Wordwall Embed API Endpoints.

This module provides API endpoints for:
1. Fetching oEmbed data from Wordwall
2. Validating Wordwall URLs
3. Getting template-based Wordwall activity suggestions
4. Adding Wordwall activities to lessons
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from ..services import wordwall_embed, lesson_generator
from ..core.security import limiter


router = APIRouter(prefix="/api/v1/wordwall", tags=["Wordwall Embed"])


class OembedRequest(BaseModel):
    url: str = Field(..., min_length=5, max_length=2048, description="Wordwall resource or play URL")
    template_id: str = Field(default=None, max_length=10, description="Optional template ID to associate")


class OembedResponse(BaseModel):
    valid: bool
    url_type: Optional[str] = None
    resource_id: Optional[str] = None
    title: Optional[str] = None
    html: Optional[str] = None
    embed_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    author: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    error: Optional[str] = None


class ValidateUrlRequest(BaseModel):
    url: str = Field(..., min_length=5, max_length=2048)


class ValidateUrlResponse(BaseModel):
    valid: bool
    url_type: Optional[str] = None
    resource_id: Optional[str] = None
    error: Optional[str] = None


class SuggestRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=255)
    subject: str = Field(default="", max_length=255)


class SuggestResponse(BaseModel):
    suggestions: list[dict]


class AddWordwallToLessonRequest(BaseModel):
    session_id: str = Field(..., min_length=1)
    user_id: str = Field(default="default")
    wordwall_urls: list[str] = Field(default_factory=list, description="List of Wordwall URLs to add")
    template_id: str = Field(default=None, max_length=10)


class AddWordwallToLessonResponse(BaseModel):
    success: bool
    wordwall_section: dict
    message: str


@router.post("/oembed", response_model=OembedResponse)
@limiter.limit("20/minute")
async def fetch_oembed(request: Request, req: OembedRequest):
    """Fetch oEmbed data from Wordwall for a given resource URL."""
    try:
        data = await wordwall_embed.fetch_oembed_data(req.url)
        return OembedResponse(
            valid=True,
            url_type=data.get('url_type'),
            resource_id=data.get('resource_id'),
            title=data.get('title'),
            html=data.get('html'),
            embed_url=data.get('embed_url'),
            thumbnail_url=data.get('thumbnail_url'),
            author=data.get('author_name'),
            width=data.get('width'),
            height=data.get('height'),
        )
    except wordwall_embed.WordwallEmbedError as e:
        return OembedResponse(valid=False, error=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch oEmbed data: {e}")


@router.post("/validate", response_model=ValidateUrlResponse)
@limiter.limit("30/minute")
async def validate_wordwall_url(request: Request, req: ValidateUrlRequest):
    """Validate a Wordwall URL without fetching oEmbed data."""
    try:
        is_valid, url_type, resource_id = wordwall_embed.validate_wordwall_url(req.url)
        if is_valid:
            return ValidateUrlResponse(valid=True, url_type=url_type, resource_id=resource_id)
        else:
            return ValidateUrlResponse(valid=False, error="Invalid Wordwall URL format")
    except Exception as e:
        return ValidateUrlResponse(valid=False, error=str(e))


@router.post("/suggest", response_model=SuggestResponse)
@limiter.limit("10/minute")
async def suggest_wordwall_activities(request: Request, req: SuggestRequest):
    """Get suggested Wordwall activity types for a topic/subject."""
    try:
        suggestions = wordwall_embed.get_wordwall_template_suggestions(req.topic, req.subject)
        return SuggestResponse(suggestions=suggestions)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get suggestions: {e}")


@router.post("/add-to-lesson", response_model=AddWordwallToLessonResponse)
@limiter.limit("5/minute")
async def add_wordwall_to_lesson(request: Request, req: AddWordwallToLessonRequest):
    """Add Wordwall activities to an existing lesson."""
    try:
        # Load the lesson
        lesson = lesson_generator.load_lesson(req.session_id, req.user_id)
        if not lesson:
            raise HTTPException(status_code=404, detail="Lesson not found")
        
        # Create Wordwall section
        wordwall_section = wordwall_embed.create_lesson_wordwall_section(
            lesson, req.wordwall_urls
        )
        
        # Update lesson with Wordwall section
        if 'presentation' not in lesson:
            lesson['presentation'] = {}
        lesson['presentation']['wordwall'] = wordwall_section
        
        # Save the updated lesson
        lesson_generator.save_lesson(lesson, req.session_id, req.user_id)
        
        return AddWordwallToLessonResponse(
            success=True,
            wordwall_section=wordwall_section,
            message=f"Added {len(req.wordwall_urls)} Wordwall activities to lesson"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add Wordwall activities: {e}")


@router.get("/resource/{resource_id}")
@limiter.limit("30/minute")
async def get_wordwall_resource(request: Request, resource_id: str):
    """Get oEmbed data for a Wordwall resource by ID."""
    url = f"https://wordwall.net/resource/{resource_id}"
    try:
        data = await wordwall_embed.fetch_oembed_data(url)
        return data
    except wordwall_embed.WordwallEmbedError as e:
        raise HTTPException(status_code=404, detail=f"Wordwall resource not found: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch resource: {e}")
