import os
import shutil
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services.document_processor import process_document

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


@router.post("/extract-text")
async def extract_text(file: UploadFile = File(...)):
    ext = Path(file.filename).suffix.lower()

    if ext not in IMAGE_EXTENSIONS and ext not in DOCUMENT_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file extension: {ext}",
        )

    temp_file = f"temp_{file.filename}"
    with open(temp_file, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        if ext in DOCUMENT_EXTENSIONS:
            result = process_document(temp_file, file.filename)
            return {
                "status": "success",
                "text": result["text"],
                "file_type": result["file_type"],
                "pages": result["pages"],
            }

        model = _get_ocr_model()
        if not model:
            raise HTTPException(
                status_code=503,
                detail="OCR is not available in this deployment.",
            )

        result = model.ocr(temp_file, cls=True)

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

        clean_text = "\n".join(extracted_text)
        return {
            "status": "success",
            "text": clean_text,
            "file_type": "image",
            "pages": 1,
        }

    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"File processing error: {exc}") from exc
    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)
