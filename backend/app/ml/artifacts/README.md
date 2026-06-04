# AI model

Put exported ONNX models here as:

```text
backend/app/ml/artifacts/best.onnx
backend/app/ml/artifacts/quickdraw.onnx
backend/app/ml/artifacts/letter.onnx
```

The original `.pt` file is intentionally ignored by Git because it is usually large and may be trained/private data.

If an ONNX file uses external data, keep its `.onnx.data` file next to it.

If an ONNX file does not include class names metadata, add a class file here:

```text
classes.txt
quickdraw_classes.txt
letter_classes.txt
```

Use one label per line, or `class_id: label`, for example:

```text
0: 1
1: 2
2: 3
```

The letter model is prepared but optional. When you receive it, add `letter.onnx`
and `letter_classes.txt`; if the model has external data, add `letter.onnx.data`
in the same folder.
