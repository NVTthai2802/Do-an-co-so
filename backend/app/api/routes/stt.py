from fastapi import APIRouter, Header

from app.db.connection import get_db
from app.schemas.stt import EvaluateReadingReq
from app.services.learning_results import record_learning_result
from app.services.session_auth import get_session_user
from app.services.stt_service import evaluate_reading

router = APIRouter(prefix="/stt", tags=["stt"])

@router.post("/evaluate-reading")
def evaluate_reading_endpoint(req: EvaluateReadingReq, authorization: str | None = Header(None)):
    result = evaluate_reading(req.reference_text, req.spoken_text)

    if authorization and authorization.startswith("Bearer "):
        try:
            with get_db() as conn:
                _, user = get_session_user(conn, authorization)
                record_learning_result(
                    conn,
                    user["id"],
                    module_key="reading",
                    activity_key="speech_evaluation",
                    title="Luyện đọc bằng giọng nói",
                    score=float(result.get("accuracy") or 0),
                    max_score=100,
                    accuracy=float(result.get("accuracy") or 0),
                    time_spent_seconds=0,
                    detail={
                        "reference_text": req.reference_text,
                        "spoken_text": req.spoken_text,
                        "accuracy": result.get("accuracy", 0),
                        "correct_words": result.get("correct_words", []),
                        "wrong_words": result.get("wrong_words", []),
                        "missing_words": result.get("missing_words", []),
                        "extra_words": result.get("extra_words", []),
                        "total_words": result.get("total_words", 0),
                        "correct_count": result.get("correct_count", 0),
                        "feedback": result.get("feedback", ""),
                    },
                )
        except Exception:
            # The reading result should still be returned even if analytics logging fails.
            pass

    return result
