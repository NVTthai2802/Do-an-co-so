import ast
import base64
import binascii
import io
import os
import re
import threading
from pathlib import Path

from fastapi import HTTPException

MODEL_PATH = Path(__file__).resolve().parent / "models" / "best.onnx"
CLASS_NAMES_PATH = Path(__file__).resolve().parent / "models" / "classes.txt"
DEFAULT_INPUT_SIZE = 640


def get_confidence_threshold() -> float:
    try:
        return float(os.getenv("KIDLEARN_RECOGNITION_CONFIDENCE", "0.25"))
    except ValueError:
        return 0.25


CONFIDENCE_THRESHOLD = get_confidence_threshold()

_SESSION_INFO = None
_SESSION_LOCK = threading.Lock()


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
            detail="Backend chua cai Pillow. Chay: pip install -r backend/requirements.txt",
        ) from exc

    try:
        return Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Khong doc duoc anh.") from exc


def to_positive_int(value, fallback: int) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError):
        return fallback
    return number if number > 0 else fallback


def is_three_channels(value) -> bool:
    try:
        return int(value) == 3
    except (TypeError, ValueError):
        return False


def get_input_spec(input_shape):
    layout = "nchw"
    height = DEFAULT_INPUT_SIZE
    width = DEFAULT_INPUT_SIZE

    if len(input_shape) == 4:
        if is_three_channels(input_shape[-1]):
            layout = "nhwc"
            height = to_positive_int(input_shape[1], DEFAULT_INPUT_SIZE)
            width = to_positive_int(input_shape[2], DEFAULT_INPUT_SIZE)
        else:
            height = to_positive_int(input_shape[2], DEFAULT_INPUT_SIZE)
            width = to_positive_int(input_shape[3], DEFAULT_INPUT_SIZE)

    return layout, width, height


def normalize_class_names(value):
    if isinstance(value, dict):
        names = {}
        for key, label in value.items():
            try:
                names[int(key)] = str(label)
            except (TypeError, ValueError):
                continue
        return names

    if isinstance(value, (list, tuple)):
        return {index: str(label) for index, label in enumerate(value)}

    return {}


def parse_class_names(value: str):
    value = value.strip()
    if not value:
        return {}

    try:
        return normalize_class_names(ast.literal_eval(value))
    except (SyntaxError, ValueError):
        pass

    if "," in value:
        return {
            index: label.strip()
            for index, label in enumerate(value.split(","))
            if label.strip()
        }

    return {}


def load_class_names_file():
    if not CLASS_NAMES_PATH.exists():
        return {}

    names = {}
    for fallback_index, line in enumerate(CLASS_NAMES_PATH.read_text(encoding="utf-8").splitlines()):
        line = line.strip()
        if not line or line.startswith("#"):
            continue

        if ":" in line:
            raw_index, label = line.split(":", 1)
            try:
                names[int(raw_index.strip())] = label.strip()
                continue
            except ValueError:
                pass

        names[fallback_index] = line
    return names


def load_class_names(session):
    file_names = load_class_names_file()
    if file_names:
        return file_names

    metadata = session.get_modelmeta().custom_metadata_map
    for key in ("names", "classes", "labels"):
        names = parse_class_names(metadata.get(key, ""))
        if names:
            return names

    return {}


def get_session_info():
    global _SESSION_INFO
    if _SESSION_INFO is not None:
        return _SESSION_INFO

    if not MODEL_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail="Chua tim thay backend/models/best.onnx.",
        )

    try:
        import onnxruntime as ort
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail="Backend chua cai onnxruntime. Chay: pip install -r backend/requirements.txt",
        ) from exc

    with _SESSION_LOCK:
        if _SESSION_INFO is None:
            try:
                session = ort.InferenceSession(
                    str(MODEL_PATH),
                    providers=["CPUExecutionProvider"],
                )
            except Exception as exc:
                raise HTTPException(
                    status_code=503,
                    detail="Khong load duoc backend/models/best.onnx.",
                ) from exc

            input_meta = session.get_inputs()[0]
            layout, width, height = get_input_spec(input_meta.shape)
            _SESSION_INFO = {
                "session": session,
                "input_name": input_meta.name,
                "layout": layout,
                "width": width,
                "height": height,
                "class_names": load_class_names(session),
            }

    return _SESSION_INFO


def resize_with_padding(image, width: int, height: int):
    from PIL import Image

    scale = min(width / image.width, height / image.height)
    resized_width = max(1, int(round(image.width * scale)))
    resized_height = max(1, int(round(image.height * scale)))
    resized = image.resize((resized_width, resized_height))

    canvas = Image.new("RGB", (width, height), (114, 114, 114))
    paste_x = (width - resized_width) // 2
    paste_y = (height - resized_height) // 2
    canvas.paste(resized, (paste_x, paste_y))
    return canvas


def preprocess_image(image, session_info):
    try:
        import numpy as np
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail="Backend chua cai numpy. Chay: pip install -r backend/requirements.txt",
        ) from exc

    resized = resize_with_padding(image, session_info["width"], session_info["height"])
    input_array = np.asarray(resized, dtype=np.float32) / 255.0

    if session_info["layout"] == "nchw":
        input_array = np.transpose(input_array, (2, 0, 1))

    return np.expand_dims(input_array, axis=0).astype(np.float32)


def get_class_name(names, class_id: int) -> str:
    return str(names.get(class_id, class_id))


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


def normalize_classification_scores(scores, np):
    scores = scores.astype(np.float32)
    if scores.size == 0:
        return scores

    total = float(scores.sum())
    if scores.min() < 0 or scores.max() > 1 or not 0.8 <= total <= 1.2:
        shifted = scores - scores.max()
        exp_scores = np.exp(shifted)
        return exp_scores / exp_scores.sum()

    return scores


def prediction_tuple(names, class_id: int, confidence: float):
    label = get_class_name(names, class_id)
    return label, extract_number(label), float(confidence)


def parse_classification_output(array, names, np):
    squeezed = np.squeeze(array)
    if squeezed.ndim != 1 or squeezed.size > 1000:
        return None

    scores = normalize_classification_scores(squeezed, np)
    class_id = int(np.argmax(scores))
    return prediction_tuple(names, class_id, float(scores[class_id]))


def guess_class_start(attribute_count: int, names) -> int:
    class_count = len(names)
    if class_count and attribute_count >= class_count + 4:
        return attribute_count - class_count

    # YOLOv8 ONNX exports usually use [x, y, w, h, class...].
    return 4


def parse_detection_output(array, names, np):
    predictions = np.squeeze(array)
    if predictions.ndim != 2 or 0 in predictions.shape:
        return None

    # NMS-style output: [x1, y1, x2, y2, score, class_id].
    if predictions.shape[1] == 6:
        best_index = int(np.argmax(predictions[:, 4]))
        return prediction_tuple(
            names,
            int(round(float(predictions[best_index, 5]))),
            float(predictions[best_index, 4]),
        )

    # Raw YOLO output is often [attributes, candidates]; transpose to candidates first.
    if predictions.shape[0] <= predictions.shape[1] and predictions.shape[0] <= 256:
        predictions = predictions.T

    attribute_count = predictions.shape[1]
    class_start = guess_class_start(attribute_count, names)
    if attribute_count <= class_start:
        return None

    class_scores = predictions[:, class_start:]
    if class_start == 5:
        class_scores = class_scores * predictions[:, 4:5]

    best_flat_index = int(np.argmax(class_scores))
    _, class_id = np.unravel_index(best_flat_index, class_scores.shape)
    confidence = float(class_scores.reshape(-1)[best_flat_index])
    return prediction_tuple(names, int(class_id), confidence)


def parse_outputs(outputs, names):
    import numpy as np

    best_prediction = None
    for output in outputs:
        array = np.asarray(output)
        prediction = parse_classification_output(array, names, np)
        if prediction is None:
            prediction = parse_detection_output(array, names, np)

        if prediction is None:
            continue

        if best_prediction is None or prediction[2] > best_prediction[2]:
            best_prediction = prediction

    return best_prediction


def empty_prediction():
    return {"label": None, "number": None, "confidence": 0.0}


def recognize_number_from_image(image_data: str):
    image = decode_image(image_data)
    session_info = get_session_info()
    input_tensor = preprocess_image(image, session_info)
    outputs = session_info["session"].run(None, {session_info["input_name"]: input_tensor})
    prediction = parse_outputs(outputs, session_info["class_names"])

    if prediction is None:
        return empty_prediction()

    label, number, confidence = prediction
    if confidence < CONFIDENCE_THRESHOLD:
        return empty_prediction()

    return {
        "label": label,
        "number": number,
        "confidence": round(confidence, 4),
    }
