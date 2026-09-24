from __future__ import annotations

# Load backend/.env BEFORE anything reads GEMINI_API_KEY / GROQ_API_KEY.
# Without this the AI tutor silently falls back to canned replies even when a
# valid key sits in .env (root cause of the "chatbot not working" bug).
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .api import api_router
from .core.database import Base, engine
from .core.security import limiter, SecurityHeadersMiddleware

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Shaghoof Backend",
    description=(
        "Smart Education Assistant — Assessment Engine, Stretch Zone, Digital Twin, "
        "Retention, Teacher Board, AI Tutor, Quiz Generation, Flashcards, Assignments, "
        "Podcast, Feynman Evaluator, Knowledge Graph, PDF RAG, Moodle LMS Integration"
    ),
    version="3.0.0",
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Security headers
app.add_middleware(SecurityHeadersMiddleware)

# CORS
# allow_credentials is intentionally disabled: Starlette/FastAPI rejects
# wildcard allow_methods/allow_headers combinations when credentials are
# True, which produces the 400 Bad Request on pre-flight OPTIONS requests.
# The app uses localStorage (no HTTP credentials), so no user tokens cross
# origins. With credentials off, wildcard origins are safe and avoid 400s
# when Vite binds to a non-default port (5174, 5175, ...).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/")
def root():
    return {"app": "Shaghoof", "status": "ok", "docs": "/docs", "version": "3.0.0"}


@app.get("/api/v1/health")
def health():
    from .services import gemini
    return {"status": "ok", "ai_available": gemini.ai_available(), "version": "3.0.0"}
