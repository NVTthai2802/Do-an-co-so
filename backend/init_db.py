"""
Initialize the KidLearn Postgres schema.

Run:
  python init_db.py
"""

import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv

try:
    from db_schema import initialize_schema
except ImportError:
    from .db_schema import initialize_schema


def normalize_database_url(url: str) -> str:
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    return url


def get_database_url() -> str:
    load_dotenv(Path(__file__).resolve().parent / ".env")
    return normalize_database_url(
        os.getenv("DATABASE_URL")
        or os.getenv("POSTGRES_URL")
        or os.getenv("POSTGRES_PRISMA_URL")
        or os.getenv("POSTGRES_URL_NON_POOLING")
        or "postgresql://postgres:postgres@localhost:5432/kidlearn"
    )


def create_tables():
    with psycopg.connect(get_database_url()) as conn:
        initialize_schema(conn)
    print("Created KidLearn Postgres tables.")


if __name__ == "__main__":
    create_tables()
