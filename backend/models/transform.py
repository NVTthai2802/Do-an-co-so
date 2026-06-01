from ultralytics import YOLO

model = YOLO("best.pt")
model.export(format="onnx")  # Tao file best.onnx de backend chay bang ONNX Runtime.
