from fastapi import HTTPException
import psycopg
from psycopg.errors import OperationalError
from psycopg.rows import dict_row

from app.core.config import DatabaseConfigError, get_database_url
from app.db.schema import initialize_schema


SCHEMA_READY = False


def ensure_schema(conn):
    global SCHEMA_READY
    if SCHEMA_READY:
        return

    initialize_schema(conn)
    SCHEMA_READY = True


def get_db():
    try:
        conn = psycopg.connect(get_database_url(), row_factory=dict_row)
        ensure_schema(conn)
        return conn
    except DatabaseConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except OperationalError as exc:
        raise HTTPException(
            status_code=503,
            detail="Khong ket noi duoc database Postgres. Kiem tra DATABASE_URL/POSTGRES_URL.",
        ) from exc
    except psycopg.Error as exc:
        raise HTTPException(
            status_code=503,
            detail="Database chua san sang. Kiem tra cau truc bang users/sessions.",
        ) from exc
