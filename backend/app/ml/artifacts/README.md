# AI model

Put the exported ONNX model here as:

```text
backend/app/ml/artifacts/best.onnx
```

The original `.pt` file is intentionally ignored by Git because it is usually large and may be trained/private data.

If the ONNX file does not include class names metadata, add an optional `classes.txt` file here. Use one label per line, or `class_id: label`, for example:

```text
0: 1
1: 2
2: 3
```
