# ── Stage 1: build the Vite SPA ──
# VITE_API_URL is intentionally empty: the frontend then builds with API_BASE=""
# and calls the API on its own origin, so one app serves both.
FROM node:22-alpine AS frontend
WORKDIR /build
ENV VITE_API_URL=""
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

# ── Stage 2: FastAPI + the built SPA ──
FROM python:3.12-slim
WORKDIR /app/backend

COPY backend/requirements.txt ./requirements.txt
# Demo image skips the torch/transformers stack (~6GB): sentence-transformers,
# langchain-huggingface and faiss-cpu are only imported lazily by the RAG
# services, which fall back to keyword search when embeddings are unavailable.
RUN grep -vE '^[[:space:]]*(sentence-transformers|langchain-huggingface|faiss-cpu)[[:space:]]*>' requirements.txt > /tmp/req-demo.txt \
    && pip install --no-cache-dir -r /tmp/req-demo.txt \
    && rm /tmp/req-demo.txt

COPY backend/ ./
# dist lands at /app/dist → backend/app/main.py parents[2] == /app.
COPY --from=frontend /build/dist /app/dist

EXPOSE 8000
# Render injects $PORT and routes to it; Fly sets no PORT → 8000 (see fly.toml).
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
