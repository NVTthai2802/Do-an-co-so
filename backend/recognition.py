import base64
import binascii
import io
import re
import threading
from pathlib import Path

from fastapi import HTTPException

MODEL_PATH = Path(__file__).resolve().parent / "models" / "best.pt"
_MODEL = None
_MODEL_LOCK = threading.Lock()


def decode_image(image_data: str):
    if "," in image_data:
        image_data = image_data.split(",", 1)[1]

    try:
        raw = base64.b64decode(image_data, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise HTTPException(status_code=400, detail="Du lieu anh khong hop le.") from exc

    try:
        from PIL import Image
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail="Backend chua cai Pillow. Cai goi AI trong backend/requirements-ai.txt.",
        ) from exc

    try:
        return Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Khong doc duoc anh.") from exc


def get_model():
    global _MODEL
    if _MODEL is not None:
        return _MODEL

    if not MODEL_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail="Chua tim thay backend/models/best.pt.",
        )

    try:
        from ultralytics import YOLO
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail="Backend chua cai ultralytics. Cai goi AI trong backend/requirements-ai.txt.",
        ) from exc

    with _MODEL_LOCK:
        if _MODEL is None:
            _MODEL = YOLO(str(MODEL_PATH))
    return _MODEL


def get_class_name(names, class_id: int) -> str:
    if isinstance(names, dict):
        return str(names.get(class_id, class_id))

    try:
        return str(names[class_id])
    except (IndexError, TypeError):
        return str(class_id)


def extract_number(label: str):
    for value in re.findall(r"\d+", label):
        number = int(value)
        if 0 <= number <= 10:
            return number

    normalized = label.lower().strip().replace("_", " ").replace("-", " ")
    words = {
        "zero": 0,
        "khong": 0,
        "mot": 1,
        "one": 1,
        "hai": 2,
        "two": 2,
        "ba": 3,
        "three": 3,
        "bon": 4,
        "four": 4,
        "nam": 5,
        "five": 5,
        "sau": 6,
        "six": 6,
        "bay": 7,
        "seven": 7,
        "tam": 8,
        "eight": 8,
        "chin": 9,
        "nine": 9,
        "muoi": 10,
        "ten": 10,
    }
    return words.get(normalized)


def parse_prediction(result):
    names = getattr(result, "names", None) or {}

    probs = getattr(result, "probs", None)
    if probs is not None:
        class_id = int(probs.top1)
        label = get_class_name(names, class_id)
        confidence = float(probs.top1conf)
        return label, extract_number(label), confidence

    boxes = getattr(result, "boxes", None)
    if boxes is None or len(boxes) == 0:
        return None, None, 0.0

    confidences = boxes.conf.tolist()
    best_index = max(range(len(confidences)), key=confidences.__getitem__)
    class_id = int(boxes.cls[best_index].item())
    label = get_class_name(names, class_id)
    confidence = float(confidences[best_index])
    return label, extract_number(label), confidence


def recognize_number_from_image(image_data: str):
    image = decode_image(image_data)
    model = get_model()
    results = model.predict(image, verbose=False)
    if not results:
        return {"label": None, "number": None, "confidence": 0.0}

    label, number, confidence = parse_prediction(results[0])
    return {
        "label": label,
        "number": number,
        "confidence": round(confidence, 4),
    }
