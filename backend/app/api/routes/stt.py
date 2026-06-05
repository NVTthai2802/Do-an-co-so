from fastapi import APIRouter
from app.schemas.stt import EvaluateReadingReq
from app.services.stt_service import evaluate_reading

router = APIRouter(prefix="/stt", tags=["stt"])

@router.post("/evaluate-reading")
def evaluate_reading_endpoint(req: EvaluateReadingReq):
    result = evaluate_reading(req.reference_text, req.spoken_text)
    return result
