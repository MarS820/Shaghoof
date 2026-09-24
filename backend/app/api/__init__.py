from fastapi import APIRouter
from . import assess, stretch, profile, retention, teacher
from . import tutor, quiz_gen, flashcards, assignments, moodle, pdf_chat, lessons, video_lesson, personalization, wordwall_embed, championship

api_router = APIRouter()

# Existing routers
api_router.include_router(assess.router)
api_router.include_router(stretch.router)
api_router.include_router(profile.router)
api_router.include_router(retention.router)
api_router.include_router(teacher.router)

# New routers from SHAGHOOF-AI integration
# (podcast routes live in championship.py — rate-limited TTS + generate)
api_router.include_router(tutor.router)
api_router.include_router(quiz_gen.router)
api_router.include_router(flashcards.router)
api_router.include_router(assignments.router)
api_router.include_router(moodle.router)
api_router.include_router(pdf_chat.router)
api_router.include_router(lessons.router)
api_router.include_router(video_lesson.router)
api_router.include_router(personalization.router)
api_router.include_router(wordwall_embed.router)
api_router.include_router(championship.router)
