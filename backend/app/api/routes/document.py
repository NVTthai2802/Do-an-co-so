from fastapi import APIRouter, UploadFile, File, HTTPException
from paddleocr import PaddleOCR
import shutil
import os

router = APIRouter()

# Khởi tạo mô hình PaddleOCR (Sẽ tải pre-trained weights trong lần chạy đầu tiên)
# use_angle_cls=True giúp nhận diện chữ bị nghiêng/lật
print("⏳ Đang tải mô hình PaddleOCR...")
try:
    ocr_model = PaddleOCR(use_angle_cls=True, lang='vi')
    print("✅ Load PaddleOCR thành công!")
except Exception as e:
    print(f"⚠️ Lỗi load PaddleOCR: {e}")
    ocr_model = None

@router.post("/extract-text")
async def extract_text(file: UploadFile = File(...)):
    if not ocr_model:
        raise HTTPException(status_code=500, detail="Mô hình OCR chưa sẵn sàng.")

    # 1. Lưu file tạm thời vào server để OCR đọc
    temp_file = f"temp_{file.filename}"
    with open(temp_file, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        # 2. Đưa ảnh vào PaddleOCR
        # cls=True kích hoạt phân loại góc nghiêng
        result = ocr_model.ocr(temp_file, cls=True)
        
        # 3. Trích xuất và làm sạch văn bản
        extracted_text = []
        if result and result[0]: # Kiểm tra xem có nhận diện được chữ nào không
            for line in result[0]:
                # Cấu trúc result của PaddleOCR: [[[x,y], [x,y]...], ('Text', Confidence)]
                text = line[1][0]
                confidence = line[1][1]
                
                # Chỉ lấy những chữ AI tự tin trên 60% để lọc nhiễu
                if confidence > 0.6:
                    extracted_text.append(text)
        
        # Nối các dòng lại thành một văn bản hoàn chỉnh
        clean_text = "\n".join(extracted_text)
        return {"status": "success", "text": clean_text}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi xử lý OCR: {str(e)}")
    finally:
        # 4. Dọn dẹp: Xóa file ảnh tạm sau khi trích xuất xong
        if os.path.exists(temp_file):
            os.remove(temp_file)