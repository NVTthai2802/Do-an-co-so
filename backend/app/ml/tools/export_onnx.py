from pathlib import Path

from ultralytics import YOLO


ARTIFACTS_DIR = Path(__file__).resolve().parents[1] / "artifacts"
SOURCE_MODEL = ARTIFACTS_DIR / "best.pt"

model = YOLO(str(SOURCE_MODEL))
model.export(format="onnx")  # Exports best.onnx next to best.pt for ONNX Runtime.
