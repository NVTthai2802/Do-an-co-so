import os
import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, Header, HTTPException, UploadFile

from app.db.connection import get_db
from app.schemas.learning import DocumentSummaryReq
from app.services.document_processor import process_document
from app.services.learning_results import (
    record_document_summary,
    record_learning_result,
)
from app.services.session_auth import get_session_user
from app.services.summarizer import summarize_text

try:
    from paddleocr import PaddleOCR
except Exception:
    PaddleOCR = None


router = APIRouter(prefix="/document", tags=["document"])

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tiff"}
DOCUMENT_EXTENSIONS = {".pdf", ".docx", ".doc", ".pptx", ".ppt"}

ocr_model = None


def _get_ocr_model():
    global ocr_model

    if ocr_model is not None:
        return ocr_model

    if PaddleOCR is None:
        return None

    try:
        ocr_model = PaddleOCR(use_angle_cls=True, lang="vi", enable_mkldnn=False)
    except Exception:
        ocr_model = None

    return ocr_model


def _extract_text_from_image(file_path: str) -> str:
    model = _get_ocr_model()
    if not model:
        raise HTTPException(status_code=503, detail="OCR chua san sang tren may nay.")

    result = model.ocr(file_path, cls=True)
    extracted_text = []

    if result and result[0]:
        if isinstance(result[0], dict):
            rec_texts = result[0].get("rec_texts", [])
            rec_scores = result[0].get("rec_scores", [])
            for text, confidence in zip(rec_texts, rec_scores):
                if confidence > 0.6:
                    extracted_text.append(text)
        else:
            for line in result[0]:
                text = line[1][0]
                confidence = line[1][1]
                if confidence > 0.6:
                    extracted_text.append(text)

    return "\n".join(extracted_text)


def _process_document_file(temp_path: str, filename: str) -> dict:
    ext = Path(filename).suffix.lower()
    if ext in DOCUMENT_EXTENSIONS:
        result = process_document(temp_path, filename)
        return {
            "text": result["text"] or "",
            "pages": result["pages"],
            "file_type": result["file_type"],
        }

    if ext in IMAGE_EXTENSIONS:
        return {
            "text": _extract_text_from_image(temp_path),
            "pages": 1,
            "file_type": "image",
        }

    raise HTTPException(
        status_code=400,
        detail=f"Dinh dang file khong duoc ho tro: {ext}",
    )


@router.post("/extract-text")
async def extract_text(file: UploadFile = File(...)):
    temp_file = tempfile.NamedTemporaryFile(delete=False)
    temp_path = temp_file.name
    temp_file.close()

    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        result = _process_document_file(temp_path, file.filename)
        return {
            "status": "success",
            "text": result["text"],
            "file_type": result["file_type"],
            "pages": result["pages"],
        }
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"File processing error: {exc}") from exc
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@router.post("/summarize")
def summarize_document(
    req: DocumentSummaryReq,
    authorization: str | None = Header(None),
):
    summary = summarize_text(req.text)
    response = {
        "summary": summary["summary"],
        "original_length": summary["original_length"],
        "summary_length": summary["summary_length"],
        "sentence_count": summary["sentence_count"],
    }

    if not req.text.strip():
        return response

    if authorization and authorization.startswith("Bearer "):
        with get_db() as conn:
            _, user = get_session_user(conn, authorization)
            document_summary = record_document_summary(
                conn,
                user["id"],
                source_name=req.source_name,
                source_type=req.source_type,
                original_text=req.text,
                summary_text=summary["summary"],
                sentence_count=summary["sentence_count"],
                original_length=summary["original_length"],
                summary_length=summary["summary_length"],
            )
            learning_result = record_learning_result(
                conn,
                user["id"],
                module_key="document",
                activity_key="ocr_summary",
                title="Tom tat van ban OCR",
                score=100 if summary["summary"] else 0,
                max_score=100,
                accuracy=None,
                time_spent_seconds=0,
                detail={
                    "source_name": req.source_name or "",
                    "source_type": req.source_type,
                    "sentence_count": summary["sentence_count"],
                    "original_length": summary["original_length"],
                    "summary_length": summary["summary_length"],
                },
            )
            response["document_summary"] = document_summary
            response["learning_result"] = learning_result

    return response

