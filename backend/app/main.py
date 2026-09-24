from __future__ import annotations

import os
from pathlib import Path

# Load backend/.env BEFORE anything reads GEMINI_API_KEY / GROQ_API_KEY.
# Without this the AI tutor silently falls back to canned replies even when a
# valid key sits in .env (root cause of the "chatbot not working" bug).
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
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

# Vite build output, served same-origin by this process so one Fly app can host
# both the SPA and the API (frontend builds with API_BASE="" → relative URLs).
# Locally: <repo>/dist (npm run build). In Docker: /app/dist (copied in image).
# FRONTEND_DIST overrides both. Path resolution: backend/app/main.py → parents[2]
# is the repo root locally and /app in the container.
DIST_DIR = Path(os.environ.get("FRONTEND_DIST") or Path(__file__).resolve().parents[2] / "dist")

# Prefixes the SPA must never swallow — these fall through to JSON 404s so API
# clients don't receive index.html when they hit a missing endpoint.
_RESERVED = ("api/", "api", "docs", "redoc", "openapi.json")


def _index_response() -> FileResponse | JSONResponse:
    index = DIST_DIR / "index.html"
    if index.is_file():
        return FileResponse(index, headers={"Cache-Control": "no-cache"})
    # Dev/no-build fallback: the API-only JSON root.
    return JSONResponse({"app": "Shaghoof", "status": "ok", "docs": "/docs", "version": "3.0.0"})


@app.get("/")
def root():
    return _index_response()


# Must be registered BEFORE the catch-all below: FastAPI matches routes in
# registration order, and spa_fallback 404s anything under /api/.
@app.get("/api/v1/health")
def health():
    from .services import gemini
    return {"status": "ok", "ai_available": gemini.ai_available(), "version": "3.0.0"}


@app.get("/{full_path:path}", include_in_schema=False)
def spa_fallback(full_path: str):
    """Serve built assets and give every client route (/login, /dashboard, ...)
    an index.html on deep-link refresh. Registered last: FastAPI matches in
    registration order, so /api/*, /docs and /openapi.json win over this."""
    if full_path in _RESERVED or full_path.startswith(_RESERVED):
        raise HTTPException(status_code=404, detail="Not Found")
    if not DIST_DIR.is_dir():
        raise HTTPException(status_code=404, detail="Not Found")
    # resolve() + relative_to() blocks ../ traversal out of DIST_DIR.
    candidate = (DIST_DIR / full_path).resolve()
    try:
        candidate.relative_to(DIST_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=404, detail="Not Found")
    if candidate.is_file():
        headers = {}
        if full_path.startswith("assets/"):
            # Vite content-hashes these names — safe to cache forever.
            headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return FileResponse(candidate, headers=headers)
    return _index_response()
