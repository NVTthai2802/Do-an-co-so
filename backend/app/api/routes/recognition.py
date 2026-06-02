from fastapi import APIRouter

from app.ml.recognition import (
    recognize_letter_from_image,
    recognize_number_from_image,
    recognize_shape_from_image,
)
from app.schemas.recognition import ImageRecognitionReq


router = APIRouter(prefix="/api", tags=["recognition"])


@router.post("/recognize-number")
def recognize_number(req: ImageRecognitionReq):
    return recognize_number_from_image(req.image)


@router.post("/recognize-letter")
def recognize_letter(req: ImageRecognitionReq):
    return recognize_letter_from_image(req.image)


@router.post("/recognize-shape")
def recognize_shape(req: ImageRecognitionReq):
    return recognize_shape_from_image(req.image)
