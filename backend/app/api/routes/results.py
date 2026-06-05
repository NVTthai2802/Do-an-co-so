from fastapi import APIRouter, Header

from app.db.connection import get_db
from app.schemas.learning import LearningResultCreate
from app.services.learning_results import (
    get_learning_dashboard,
    record_learning_result,
)
from app.services.session_auth import get_session_user


router = APIRouter(tags=["learning-results"])


@router.get("/learning-results")
def get_learning_results(
    authorization: str | None = Header(None),
    limit: int = 12,
):
    with get_db() as conn:
        _, user = get_session_user(conn, authorization)
        return get_learning_dashboard(conn, user["id"], user_name=user["name"], limit=limit)


@router.get("/learning-results/dashboard")
def get_learning_dashboard_view(
    authorization: str | None = Header(None),
    limit: int = 12,
):
    with get_db() as conn:
        _, user = get_session_user(conn, authorization)
        return get_learning_dashboard(conn, user["id"], user_name=user["name"], limit=limit)


@router.post("/learning-results")
def create_learning_result(
    req: LearningResultCreate,
    authorization: str | None = Header(None),
):
    with get_db() as conn:
        _, user = get_session_user(conn, authorization)
        return record_learning_result(
            conn,
            user["id"],
            module_key=req.module_key.strip(),
            activity_key=req.activity_key.strip(),
            title=req.title.strip(),
            score=req.score,
            max_score=req.max_score,
            accuracy=req.accuracy,
            time_spent_seconds=req.time_spent_seconds,
            detail=req.detail,
        )
