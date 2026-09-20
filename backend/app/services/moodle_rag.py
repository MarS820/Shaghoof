from __future__ import annotations
import os
import re
import json
import logging
from typing import Any, Optional

from ..core.config import settings

logger = logging.getLogger(__name__)

_BASE_VEC = os.path.join(os.path.dirname(__file__), "..", "..", "storage", "moodle_vectors")
os.makedirs(_BASE_VEC, exist_ok=True)

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
            class _FB:
                def __init__(self):
                    self.model = SentenceTransformer("all-MiniLM-L6-v2")
                def embed_documents(self, texts):
                    return self.model.encode(texts).tolist()
                def embed_query(self, text):
                    return self.model.encode([text])[0].tolist()
            _embeddings = _FB()
        except Exception:
            _embeddings = None
    return _embeddings


def _user_dir(user_id: str) -> str:
    safe = re.sub(r'[^a-zA-Z0-9_\-]', '_', user_id.strip())
    path = os.path.join(_BASE_VEC, safe)
    os.makedirs(path, exist_ok=True)
    return path


def extract_text_by_pages(pdf_path: str) -> list[tuple[int, str]]:
    pages = []
    try:
        import pymupdf
        doc = pymupdf.open(pdf_path)
        for i in range(len(doc)):
            text = doc[i].get_text()
            if text and text.strip():
                pages.append((i + 1, text.strip()))
        doc.close()
        if pages:
            return pages
    except Exception:
        pass
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(pdf_path)
        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            if text and text.strip():
                pages.append((i + 1, text.strip()))
    except Exception:
        pass
    return pages


def chunk_document(pages: list[tuple[int, str]], metadata_base: dict, chunk_size: int = 800, overlap: int = 150) -> list[dict]:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=overlap)
    chunks = []
    for page_num, content in pages:
        for idx, split in enumerate(splitter.split_text(content)):
            meta = dict(metadata_base)
            meta["page_number"] = page_num
            meta["chunk_id"] = f"{metadata_base.get('moodle_file_id', 'f')}_p{page_num}_c{idx}"
            chunks.append({"text": split, "metadata": meta})
    return chunks


def index_chunks(user_id: str, chunks: list[dict]):
    if not chunks:
        return
    udir = _user_dir(user_id)
    meta_file = os.path.join(udir, "metadata_store.json")
    existing = []
    if os.path.exists(meta_file):
        try:
            with open(meta_file, "r", encoding="utf-8") as f:
                existing = json.load(f)
        except Exception:
            existing = []
    new_ids = {c["metadata"].get("chunk_id") for c in chunks}
    filtered = [e for e in existing if e.get("metadata", {}).get("chunk_id") not in new_ids] + chunks
    with open(meta_file, "w", encoding="utf-8") as f:
        json.dump(filtered, f, ensure_ascii=False, indent=2)

    embeddings = _get_embeddings()
    if embeddings is None:
        return
    try:
        from langchain_community.vectorstores import FAISS
        index_file = os.path.join(udir, "index.faiss")
        texts = [c["text"] for c in chunks]
        metas = [c["metadata"] for c in chunks]
        if os.path.exists(index_file):
            vs = FAISS.load_local(udir, embeddings, allow_dangerous_deserialization=True)
            vs.add_texts(texts=texts, metadatas=metas)
        else:
            vs = FAISS.from_texts(texts=texts, embedding=embeddings, metadatas=metas)
        vs.save_local(udir)
    except Exception as e:
        logger.warning("FAISS indexing failed: %s", e)


def query_user_kb(user_id: str, query: str, course_id: int | None = None, top_k: int = 5, language: str = "ar") -> dict:
    udir = _user_dir(user_id)
    meta_file = os.path.join(udir, "metadata_store.json")
    matched = []
    embeddings = _get_embeddings()

    if embeddings is not None:
        try:
            from langchain_community.vectorstores import FAISS
            if os.path.exists(os.path.join(udir, "index.faiss")):
                vs = FAISS.load_local(udir, embeddings, allow_dangerous_deserialization=True)
                docs = vs.similarity_search(query, k=top_k * 2)
                for d in docs:
                    m = d.metadata or {}
                    if course_id and str(m.get("course_id")) != str(course_id):
                        continue
                    matched.append({"text": d.page_content, "metadata": m})
                    if len(matched) >= top_k:
                        break
        except Exception:
            pass

    if not matched and os.path.exists(meta_file):
        try:
            with open(meta_file, "r", encoding="utf-8") as f:
                all_chunks = json.load(f)
            terms = [t.lower() for t in query.split() if len(t) > 2]
            scored = []
            for item in all_chunks:
                m = item.get("metadata", {})
                if course_id and str(m.get("course_id")) != str(course_id):
                    continue
                s = sum(1 for t in terms if t in item.get("text", "").lower())
                if s > 0:
                    scored.append((s, item))
            scored.sort(key=lambda x: x[0], reverse=True)
            matched = [c for _, c in scored[:top_k]]
        except Exception:
            pass

    citations = []
    seen = set()
    for c in matched:
        m = c.get("metadata", {})
        key = (m.get("course_name", ""), m.get("filename", ""), m.get("page_number", 0))
        if key not in seen:
            seen.add(key)
            citations.append({"course_name": m.get("course_name", ""), "filename": m.get("filename", ""),
                              "section_name": m.get("section_name", ""), "page_number": m.get("page_number", 0),
                              "source_chunk_preview": c.get("text", "")[:120] + "..."})

    answer = _generate_answer(query, matched, citations, language)
    return {"answer": answer, "citations": citations, "course_filtered": str(course_id) if course_id else "all"}


def _generate_answer(query: str, chunks: list, citations: list, language: str = "ar") -> str:
    if not chunks:
        return ("لم يتم العثور على مراجع. تأكد من تفعيل المقرر." if language == "ar"
                else "No matching content found. Ensure the course is activated and synced.")
    context = "\n\n---\n\n".join([
        f"[{c['metadata'].get('course_name')} | {c['metadata'].get('filename')} | p{c['metadata'].get('page_number')}]\n{c['text']}"
        for c in chunks
    ])
    cit_summary = "\n".join([f"- [{c['course_name']}, {c['filename']}, p{c['page_number']}]" for c in citations])

    groq_key = settings.GROQ_API_KEY or os.getenv("GROQ_API_KEY")
    if groq_key:
        try:
            from langchain_groq import ChatGroq
            llm = ChatGroq(groq_api_key=groq_key, model_name=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"), temperature=0.2)
            sys_prompt = ("You are an academic AI tutor. Answer strictly from the provided Moodle course documents. "
                          "Include citations at the end with course, file, and page number.")
            resp = llm.invoke([("system", sys_prompt), ("user", f"Moodle Context:\n{context}\n\nQuestion:\n{query}")])
            return resp.content.strip()
        except Exception:
            pass
    primary = chunks[0]["text"]
    label = "المصادر المعتمدة" if language == "ar" else "Referenced Sources"
    return f"Based on course materials:\n\n{primary}\n\n**{label}:**\n{cit_summary}"
