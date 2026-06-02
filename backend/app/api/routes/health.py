from fastapi import APIRouter, HTTPException
from psycopg.errors import OperationalError

from app.db.connection import get_db


router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    try:
        with get_db() as conn:
            conn.execute("SELECT 1")
    except OperationalError as exc:
        raise HTTPException(
            status_code=503,
            detail="Khong ket noi duoc database Postgres.",
        ) from exc

    return {"status": "ok", "database": "postgres"}
