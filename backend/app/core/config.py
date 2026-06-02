import os
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[2]

load_dotenv(BACKEND_DIR / ".env")

DEFAULT_LOCAL_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/kidlearn"
LOCAL_DATABASE_HOSTS = {"localhost", "127.0.0.1", "::1"}
SSL_MODE_ALIASES = {"req": "require"}
VALID_SSL_MODES = {"disable", "allow", "prefer", "require", "verify-ca", "verify-full"}
LIBPQ_QUERY_PARAMS = {
    "application_name",
    "channel_binding",
    "connect_timeout",
    "gssencmode",
    "keepalives",
    "keepalives_count",
    "keepalives_idle",
    "keepalives_interval",
    "options",
    "sslcert",
    "sslcrl",
    "sslkey",
    "sslmode",
    "sslrootcert",
    "target_session_attrs",
}


class DatabaseConfigError(RuntimeError):
    pass


def normalize_database_url(url: str) -> str:
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    parsed = urlparse(url)
    if os.getenv("VERCEL") == "1" and parsed.hostname in LOCAL_DATABASE_HOSTS:
        raise DatabaseConfigError(
            "DATABASE_URL dang tro toi localhost. Tren Vercel phai dung Postgres cloud "
            "nhu Vercel Postgres, Neon hoac Supabase."
        )

    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    safe_query = {
        key: value
        for key, value in query.items()
        if key in LIBPQ_QUERY_PARAMS
    }
    sslmode = safe_query.get("sslmode")
    if sslmode:
        normalized_sslmode = SSL_MODE_ALIASES.get(sslmode.lower(), sslmode.lower())
        if normalized_sslmode not in VALID_SSL_MODES:
            raise DatabaseConfigError(
                "sslmode trong DATABASE_URL khong hop le. Hay dung sslmode=require cho Neon."
            )
        safe_query["sslmode"] = normalized_sslmode

    if os.getenv("VERCEL") == "1" and parsed.hostname not in LOCAL_DATABASE_HOSTS:
        safe_query.setdefault("sslmode", "require")

    return urlunparse(parsed._replace(query=urlencode(safe_query)))


def get_database_url() -> str:
    env_names = (
        [
            "POSTGRES_URL",
            "POSTGRES_URL_NON_POOLING",
            "DATABASE_URL",
            "POSTGRES_PRISMA_URL",
        ]
        if os.getenv("VERCEL") == "1"
        else [
            "DATABASE_URL",
            "POSTGRES_URL",
            "POSTGRES_URL_NON_POOLING",
            "POSTGRES_PRISMA_URL",
        ]
    )
    url = next((os.getenv(name) for name in env_names if os.getenv(name)), None)
    if url:
        return normalize_database_url(url)

    if os.getenv("VERCEL") == "1":
        raise DatabaseConfigError(
            "Thieu bien moi truong DATABASE_URL hoac POSTGRES_URL tren Vercel."
        )

    return DEFAULT_LOCAL_DATABASE_URL


def get_cors_origins() -> list[str]:
    raw_origins = os.getenv(
        "KIDLEARN_CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    )
    return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
