from __future__ import annotations
import os
import re
import json
import uuid
import logging
from typing import Any, Optional

from ..core.config import settings

logger = logging.getLogger(__name__)

_BASE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "storage", "pdf_rag")
os.makedirs(_BASE_DIR, exist_ok=True)

_embeddings = None


def _get_embeddings():
    global _embeddings
    if _embeddings is not None:
        return _embeddings
    try:
        from langchain_huggingface import HuggingFaceEmbeddings
        _embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    except Exception:
        try:
            from sentence_transformers import SentenceTransformer

            class _Fallback:
                def __init__(self):
                    self.model = SentenceTransformer("all-MiniLM-L6-v2")
                def embed_documents(self, texts):
                    return self.model.encode(texts).tolist()
                def embed_query(self, text):
                    return self.model.encode([text])[0].tolist()
            _embeddings = _Fallback()
        except Exception as e:
            logger.warning("Embeddings unavailable: %s", e)
            _embeddings = None
    return _embeddings


def _session_dir(session_id: str) -> str:
    safe = re.sub(r'[^a-zA-Z0-9_\-]', '_', session_id.strip())
    path = os.path.join(_BASE_DIR, safe)
    os.makedirs(path, exist_ok=True)
    return path


def _write_meta(sdir: str, session_id: str, filename: str, page_count: int, chunk_count: int) -> None:
    """Persist session metadata so uploads survive restarts and stale clients."""
    try:
        with open(os.path.join(sdir, 'meta.json'), 'w', encoding='utf-8') as f:
            json.dump({'session_id': session_id, 'filename': filename, 'page_count': page_count,
                       'chunk_count': chunk_count, 'uploaded_at': __import__('datetime').datetime.now().isoformat()}, f,
                      ensure_ascii=False)
    except Exception as e:
        logger.warning('meta.json write failed: %s', e)


def find_session_by_filename(filename: str, user_id: str = 'default') -> Optional[str]:
    """Resolve a stale sessionId to the user's newest session of that exact filename.
    Backfills meta.json for legacy sessions while scanning."""
    if not filename:
        return None
    best = None
    best_mtime = -1.0
    for name in os.listdir(_BASE_DIR):
        if not name.startswith(re.sub(r'[^a-zA-Z0-9_\-]', '_', user_id.strip())):
            continue
        chunks_file = os.path.join(_BASE_DIR, name, 'chunks.json')
        if not os.path.exists(chunks_file):
            continue
        meta_file = os.path.join(_BASE_DIR, name, 'meta.json')
        meta = None
        if os.path.exists(meta_file):
            try:
                with open(meta_file, 'r', encoding='utf-8') as f:
                    meta = json.load(f)
            except Exception:
                meta = None
        if meta is None:
            try:
                with open(chunks_file, 'r', encoding='utf-8') as f:
                    chunks = json.load(f)
                fname = (chunks[0].get('metadata', {}).get('filename', '') if chunks else '')
                page_count = 0
                chunk_count = len(chunks)
                _write_meta(os.path.join(_BASE_DIR, name), name, fname, page_count, chunk_count)
                meta = {'session_id': name, 'filename': fname, 'page_count': page_count, 'chunk_count': chunk_count}
            except Exception:
                continue
        if (meta.get('filename') or '').strip().lower() == filename.strip().lower():
            mtime = os.path.getmtime(chunks_file)
            if mtime > best_mtime:
                best_mtime = mtime
                best = meta.get('session_id') or name
    return best


def extract_text_from_pdf(pdf_bytes: bytes) -> tuple[str, int]:
    import io
    from PyPDF2 import PdfReader
    reader = PdfReader(io.BytesIO(pdf_bytes))
    text = ""
    for page in reader.pages:
        extracted = page.extract_text()
        if extracted:
            text += extracted + "\n"
    return text, len(reader.pages)


def process_and_index(pdf_bytes: bytes, filename: str, user_id: str = "default") -> dict[str, Any]:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    raw_id = f"{user_id}_{uuid.uuid4().hex[:10]}"
    # Canonicalize BEFORE returning: _session_dir stores under the sanitized
    # form, so the id we hand back to the browser must be the same one or
    # every later generate/pdf-chat call fails with "session not found".
    session_id = re.sub(r'[^a-zA-Z0-9_\-]', '_', raw_id.strip())
    text, page_count = extract_text_from_pdf(pdf_bytes)

    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = splitter.split_text(text)
    if not chunks:
        return {"session_id": session_id, "filename": filename, "page_count": page_count, "chunk_count": 0}

    embeddings = _get_embeddings()
    sdir = _session_dir(session_id)

    metadata = [{"session_id": session_id, "filename": filename, "chunk_index": i} for i in range(len(chunks))]

    if embeddings is not None:
        try:
            from langchain_community.vectorstores import FAISS
            vs = FAISS.from_texts(chunks, embedding=embeddings, metadatas=metadata)
            vs.save_local(sdir)
        except Exception as e:
            logger.warning("FAISS indexing failed: %s", e)

    with open(os.path.join(sdir, "chunks.json"), "w", encoding="utf-8") as f:
        json.dump([{"text": c, "metadata": m} for c, m in zip(chunks, metadata)], f, ensure_ascii=False)

    _write_meta(sdir, session_id, filename, page_count, len(chunks))

    return {"session_id": session_id, "filename": filename, "page_count": page_count, "chunk_count": len(chunks)}


def query_rag(
    session_id: str, query: str, history: list[dict] | None = None, language: str = "ar",
) -> dict[str, Any]:
    sdir = _session_dir(session_id)
    matched = []
    embeddings = _get_embeddings()

    if embeddings is not None:
        try:
            from langchain_community.vectorstores import FAISS
            index_path = os.path.join(sdir, "index.faiss")
            if os.path.exists(index_path):
                vs = FAISS.load_local(sdir, embeddings, allow_dangerous_deserialization=True)
                docs = vs.similarity_search(query, k=5)
                matched = [{"text": d.page_content, "metadata": d.metadata or {}} for d in docs]
        except Exception as e:
            logger.warning("FAISS query failed: %s", e)

    if not matched:
        chunks_file = os.path.join(sdir, "chunks.json")
        if os.path.exists(chunks_file):
            try:
                with open(chunks_file, "r", encoding="utf-8") as f:
                    all_chunks = json.load(f)
                terms = [t.lower() for t in query.split() if len(t) > 2]
                scored = [(sum(1 for t in terms if t in c["text"].lower()), c) for c in all_chunks]
                scored.sort(key=lambda x: x[0], reverse=True)
                matched = [c for _, c in scored[:5]]
            except Exception:
                pass

    if not matched:
        return {"answer": "No matching content found. Please upload a PDF first.", "sources": []}

    context = "\n\n---\n\n".join([f"[{c['metadata'].get('filename', '?')}]\n{c['text']}" for c in matched])
    sources = [{"filename": c["metadata"].get("filename", "?"), "chunk": c["metadata"].get("chunk_index", 0),
                "preview": c["text"][:120] + "..."} for c in matched]

    groq_key = settings.GROQ_API_KEY or os.getenv("GROQ_API_KEY")
    if groq_key:
        try:
            from langchain_groq import ChatGroq
            llm = ChatGroq(groq_api_key=groq_key, model_name=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"), temperature=0.2)
            messages = [
                ("system", (
                    "You are an expert AI tutor. Answer strictly based on the provided PDF context. "
                    "Respond in the same language as the student's question. "
                    "Provide comprehensive, well-structured explanations."
                )),
                ("user", f"PDF Context:\n{context}\n\nQuestion:\n{query}"),
            ]
            if history:
                for h in history[-6:]:
                    messages = list(messages[:-1]) + [(h.get("role", "user"), h.get("content", ""))] + [messages[-1]]
            resp = llm.invoke(messages)
            return {"answer": resp.content.strip(), "sources": sources}
        except Exception as e:
            logger.warning("RAG LLM failed: %s", e)

    primary = matched[0]["text"]
    return {"answer": f"Based on the uploaded material:\n\n{primary}", "sources": sources}
