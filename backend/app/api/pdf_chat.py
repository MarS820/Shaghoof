from fastapi import APIRouter, UploadFile, File, HTTPException
from ..schemas import PdfChatRequest, PdfChatResponse, PdfUploadResponse
from ..services import pdf_rag

router = APIRouter(prefix="/pdf", tags=["PDF Chat / RAG"])


@router.post("/upload", response_model=PdfUploadResponse)
async def upload_pdf(file: UploadFile = File(...), user_id: str = "default"):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds 50MB limit.")
    result = pdf_rag.process_and_index(content, file.filename, user_id=user_id)
    return PdfUploadResponse(**result)


@router.post("/chat", response_model=PdfChatResponse)
def pdf_chat(req: PdfChatRequest):
    if not req.session_id:
        raise HTTPException(status_code=400, detail="session_id required. Upload a PDF first.")
    result = pdf_rag.query_rag(req.session_id, req.query, history=req.history, language=req.language)
    return PdfChatResponse(answer=result.get("answer", ""), sources=result.get("sources", []))
