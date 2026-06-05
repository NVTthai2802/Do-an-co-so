from fastapi import APIRouter, UploadFile, File, HTTPException
from paddleocr import PaddleOCR
import shutil
import os
from pathlib import Path

from app.services.document_processor import process_document

router = APIRouter(prefix="/document", tags=["document"])

# Các định dạng file được hỗ trợ
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tiff"}
DOCUMENT_EXTENSIONS = {".pdf", ".docx", ".doc", ".pptx", ".ppt"}

# Khởi tạo mô hình PaddleOCR (Sẽ tải pre-trained weights trong lần chạy đầu tiên)
# use_angle_cls=True giúp nhận diện chữ bị nghiêng/lật
print("⏳ Đang tải mô hình PaddleOCR...")
try:
    ocr_model = PaddleOCR(use_angle_cls=True, lang='vi', enable_mkldnn=False)
    print("✅ Load PaddleOCR thành công!")
except Exception as e:
    print(f"⚠️ Lỗi load PaddleOCR: {e}")
    ocr_model = None

@router.post("/extract-text")
async def extract_text(file: UploadFile = File(...)):
    # Xác định loại file dựa trên phần mở rộng
    ext = Path(file.filename).suffix.lower()

    if ext not in IMAGE_EXTENSIONS and ext not in DOCUMENT_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Định dạng file không được hỗ trợ: {ext}"
        )

    # 1. Lưu file tạm thời vào server
    temp_file = f"temp_{file.filename}"
    with open(temp_file, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        # 2. Xử lý theo loại file
        if ext in DOCUMENT_EXTENSIONS:
            # Xử lý tài liệu (PDF, DOCX, PPTX) bằng document_processor
            result = process_document(temp_file, file.filename)
            return {
                "status": "success",
                "text": result["text"],
                "file_type": result["file_type"],
                "pages": result["pages"]
            }
        else:
            # Xử lý ảnh bằng PaddleOCR
            if not ocr_model:
                raise HTTPException(status_code=500, detail="Mô hình OCR chưa sẵn sàng.")

            # Đưa ảnh vào PaddleOCR
            # cls=True kích hoạt phân loại góc nghiêng
            result = ocr_model.ocr(temp_file, cls=True)

            # 3. Trích xuất và làm sạch văn bản
            extracted_text = []
            if result and result[0]: # Kiểm tra xem có nhận diện được chữ nào không
                if isinstance(result[0], dict):
                    # Định dạng kết quả mới của PaddleX/PaddleOCR (dictionary)
                    rec_texts = result[0].get("rec_texts", [])
                    rec_scores = result[0].get("rec_scores", [])
                    for text, confidence in zip(rec_texts, rec_scores):
                        if confidence > 0.6:
                            extracted_text.append(text)
                else:
                    # Định dạng kết quả cũ của PaddleOCR (list)
                    for line in result[0]:
                        text = line[1][0]
                        confidence = line[1][1]
                        if confidence > 0.6:
                            extracted_text.append(text)

            # Nối các dòng lại thành một văn bản hoàn chỉnh
            clean_text = "\n".join(extracted_text)
            return {
                "status": "success",
                "text": clean_text,
                "file_type": "image",
                "pages": 1
            }

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi xử lý file: {str(e)}")
    finally:
        # 4. Dọn dẹp: Xóa file tạm sau khi trích xuất xong
        if os.path.exists(temp_file):
            os.remove(temp_file)