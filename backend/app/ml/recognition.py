import ast
import base64
import binascii
import io
import os
import re
import threading
from dataclasses import dataclass
from pathlib import Path

from fastapi import HTTPException

ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts"
DEFAULT_INPUT_SIZE = 640


@dataclass(frozen=True)
class ModelConfig:
    key: str
    model_path: Path
    class_names_path: Path
    default_input_size: int = DEFAULT_INPUT_SIZE
    crop_foreground: bool = False
    invert_light_background: bool = False


def artifact_path(env_name: str, fallback_name: str) -> Path:
    raw_value = os.getenv(env_name)
    if raw_value:
        path = Path(raw_value)
        return path if path.is_absolute() else ARTIFACTS_DIR / path
    return ARTIFACTS_DIR / fallback_name


MODEL_CONFIGS = {
    "number": ModelConfig(
        key="number",
        model_path=artifact_path("KIDLEARN_NUMBER_MODEL", "best.onnx"),
        class_names_path=artifact_path("KIDLEARN_NUMBER_CLASSES", "classes.txt"),
    ),
    "shape": ModelConfig(
        key="shape",
        model_path=artifact_path("KIDLEARN_SHAPE_MODEL", "quickdraw.onnx"),
        class_names_path=artifact_path("KIDLEARN_SHAPE_CLASSES", "quickdraw_classes.txt"),
        default_input_size=28,
        crop_foreground=True,
        invert_light_background=True,
    ),
    "letter": ModelConfig(
        key="letter",
        model_path=artifact_path("KIDLEARN_LETTER_MODEL", "letter.onnx"),
        class_names_path=artifact_path("KIDLEARN_LETTER_CLASSES", "letter_classes.txt"),
        default_input_size=28,
        crop_foreground=True,
        invert_light_background=True,
    ),
}


def get_confidence_threshold(model_key: str) -> float:
    env_name = f"KIDLEARN_{model_key.upper()}_CONFIDENCE"
    try:
        return float(os.getenv(env_name, os.getenv("KIDLEARN_RECOGNITION_CONFIDENCE", "0.25")))
    except ValueError:
        return 0.25


_SESSION_INFO = {}
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


def get_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def is_channel_count(value) -> bool:
    return get_int(value) in (1, 3)


def get_input_spec(input_shape, default_input_size: int):
    layout = "nchw"
    height = default_input_size
    width = default_input_size
    channels = 3

    if len(input_shape) == 4:
        if is_channel_count(input_shape[-1]):
            layout = "nhwc"
            channels = get_int(input_shape[-1]) or channels
            height = to_positive_int(input_shape[1], default_input_size)
            width = to_positive_int(input_shape[2], default_input_size)
        else:
            channels = get_int(input_shape[1]) or channels
            height = to_positive_int(input_shape[2], default_input_size)
            width = to_positive_int(input_shape[3], default_input_size)

    return layout, width, height, channels


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


def load_class_names_file(path: Path):
    if not path.exists():
        return {}

    names = {}
    for fallback_index, line in enumerate(path.read_text(encoding="utf-8").splitlines()):
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


def load_class_names(session, path: Path):
    file_names = load_class_names_file(path)
    if file_names:
        return file_names

    metadata = session.get_modelmeta().custom_metadata_map
    for key in ("names", "classes", "labels"):
        names = parse_class_names(metadata.get(key, ""))
        if names:
            return names

    return {}


def get_session_info(model_key: str):
    if model_key not in MODEL_CONFIGS:
        raise HTTPException(status_code=404, detail="Model khong duoc ho tro.")

    config = MODEL_CONFIGS[model_key]
    if model_key in _SESSION_INFO:
        return _SESSION_INFO[model_key]

    if not config.model_path.exists():
        raise HTTPException(
            status_code=503,
            detail=f"Chua tim thay {config.model_path.name}.",
        )

    try:
        import onnxruntime as ort
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail="Backend chua cai onnxruntime. Chay: pip install -r backend/requirements.txt",
        ) from exc

    with _SESSION_LOCK:
        if model_key not in _SESSION_INFO:
            try:
                session = ort.InferenceSession(
                    str(config.model_path),
                    providers=["CPUExecutionProvider"],
                )
            except Exception as exc:
                raise HTTPException(
                    status_code=503,
                    detail=f"Khong load duoc {config.model_path.name}.",
                ) from exc

            input_meta = session.get_inputs()[0]
            layout, width, height, channels = get_input_spec(
                input_meta.shape,
                config.default_input_size,
            )
            _SESSION_INFO[model_key] = {
                "config": config,
                "session": session,
                "input_name": input_meta.name,
                "layout": layout,
                "width": width,
                "height": height,
                "channels": channels,
                "class_names": load_class_names(session, config.class_names_path),
            }

    return _SESSION_INFO[model_key]


def resize_with_padding(image, width: int, height: int, fill):
    from PIL import Image

    scale = min(width / image.width, height / image.height)
    resized_width = max(1, int(round(image.width * scale)))
    resized_height = max(1, int(round(image.height * scale)))
    resized = image.resize((resized_width, resized_height))

    canvas = Image.new(image.mode, (width, height), fill)
    paste_x = (width - resized_width) // 2
    paste_y = (height - resized_height) // 2
    canvas.paste(resized, (paste_x, paste_y))
    return canvas


def crop_foreground(image, np):
    array = np.asarray(image)
    if array.size == 0:
        return image

    background_is_light = float(array.mean()) > 127.0
    mask = array < 245 if background_is_light else array > 10
    if not mask.any():
        return image

    y_indices, x_indices = np.where(mask)
    x_min = int(x_indices.min())
    x_max = int(x_indices.max())
    y_min = int(y_indices.min())
    y_max = int(y_indices.max())
    padding = max(4, int(max(x_max - x_min, y_max - y_min) * 0.18))

    return image.crop(
        (
            max(0, x_min - padding),
            max(0, y_min - padding),
            min(image.width, x_max + padding + 1),
            min(image.height, y_max + padding + 1),
        )
    )


def preprocess_image(image, session_info):
    try:
        import numpy as np
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail="Backend chua cai numpy. Chay: pip install -r backend/requirements.txt",
        ) from exc

    config = session_info["config"]
    if session_info["channels"] == 1:
        from PIL import ImageOps

        working_image = ImageOps.grayscale(image)
        if config.invert_light_background and float(np.asarray(working_image).mean()) > 127.0:
            working_image = ImageOps.invert(working_image)
        if config.crop_foreground:
            working_image = crop_foreground(working_image, np)
        resized = resize_with_padding(working_image, session_info["width"], session_info["height"], 0)
        input_array = np.asarray(resized, dtype=np.float32) / 255.0

        if session_info["layout"] == "nchw":
            input_array = np.expand_dims(input_array, axis=0)
        else:
            input_array = np.expand_dims(input_array, axis=-1)
    else:
        resized = resize_with_padding(
            image.convert("RGB"),
            session_info["width"],
            session_info["height"],
            (114, 114, 114),
        )
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


def extract_letter(label: str):
    normalized = label.upper().strip()
    match = re.search(r"[A-Z]", normalized)
    return match.group(0) if match else None


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


def empty_prediction(model_key: str):
    result = {"label": None, "confidence": 0.0}
    if model_key == "number":
        result["number"] = None
    if model_key == "letter":
        result["letter"] = None
    return result


def recognize_from_image(model_key: str, image_data: str):
    image = decode_image(image_data)
    session_info = get_session_info(model_key)
    input_tensor = preprocess_image(image, session_info)
    outputs = session_info["session"].run(None, {session_info["input_name"]: input_tensor})
    prediction = parse_outputs(outputs, session_info["class_names"])

    if prediction is None:
        return empty_prediction(model_key)

    label, number, confidence = prediction
    if confidence < get_confidence_threshold(model_key):
        return empty_prediction(model_key)

    result = {
        "label": label,
        "confidence": round(confidence, 4),
    }

    if model_key == "number":
        result["number"] = number
    if model_key == "letter":
        result["letter"] = extract_letter(label)

    return result


def recognize_number_from_image(image_data: str):
    return recognize_from_image("number", image_data)


def unsupported_model_response(image_data: str, model_name: str):
    decode_image(image_data)
    raise HTTPException(
        status_code=503,
        detail=f"Chua cau hinh model nhan dang {model_name}.",
    )


def recognize_letter_from_image(image_data: str):
    return recognize_from_image("letter", image_data)


def recognize_shape_from_image(image_data: str):
    return recognize_from_image("shape", image_data)
