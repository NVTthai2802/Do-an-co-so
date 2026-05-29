import os
import secrets
import socket
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
import psycopg
from psycopg.rows import dict_row
from psycopg.errors import OperationalError
from pydantic import BaseModel
from dotenv import load_dotenv
from passlib.context import CryptContext

load_dotenv(Path(__file__).resolve().parent / ".env")
app = FastAPI(title="KidLearn API")

# ── Đọc cấu hình từ .env ──────────────────────────────
DEFAULT_LOCAL_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/kidlearn"


def normalize_database_url(url: str) -> str:
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    return url


def get_database_url() -> str:
    url = (
        os.getenv("DATABASE_URL")
        or os.getenv("POSTGRES_URL")
        or os.getenv("POSTGRES_PRISMA_URL")
        or os.getenv("POSTGRES_URL_NON_POOLING")
    )
    if url:
        return normalize_database_url(url)

    if os.getenv("VERCEL") == "1":
        raise RuntimeError("Missing DATABASE_URL or POSTGRES_URL environment variable.")

    return DEFAULT_LOCAL_DATABASE_URL


DATABASE_URL = get_database_url()
CORS_ORIGINS = os.getenv(
    "KIDLEARN_CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000"
).split(",")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SCHEMA_READY = False

# ── CORS ─────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Database helpers ──────────────────────────────────
def initialize_schema(conn):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id BIGSERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    conn.commit()


def ensure_schema(conn):
    global SCHEMA_READY
    if SCHEMA_READY:
        return

    initialize_schema(conn)
    SCHEMA_READY = True


def get_db():
    conn = psycopg.connect(DATABASE_URL, row_factory=dict_row)
    ensure_schema(conn)
    return conn


@app.on_event("startup")
def init_db():
    """Tự động tạo bảng khi server khởi động."""
    with get_db():
        pass


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


# ── Schemas ───────────────────────────────────────────
class RegisterReq(BaseModel):
    name: str
    email: str
    password: str


class LoginReq(BaseModel):
    email: str
    password: str


# ── Routes ────────────────────────────────────────────
@app.post("/auth/register")
def register(req: RegisterReq):
    email = req.email.strip().lower()
    name = req.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Vui lòng nhập họ và tên.")

    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Mật khẩu phải có ít nhất 6 ký tự.")

    with get_db() as conn:
        existing = conn.execute(
            "SELECT id FROM users WHERE email = %s", (email,)
        ).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="Email này đã được đăng ký.")

        pwd_hash = hash_password(req.password)
        user = conn.execute(
            """
            INSERT INTO users (name, email, password_hash)
            VALUES (%s, %s, %s)
            RETURNING id, name, email
            """,
            (name, email, pwd_hash),
        ).fetchone()

        token = secrets.token_hex(32)
        conn.execute(
            "INSERT INTO sessions (token, user_id) VALUES (%s, %s)",
            (token, user["id"]),
        )

        return {
            "access_token": token,
            "user": {"id": user["id"], "name": user["name"], "email": user["email"]},
        }


@app.post("/auth/login")
def login(req: LoginReq):
    email = req.email.strip().lower()
    with get_db() as conn:
        user = conn.execute(
            "SELECT * FROM users WHERE email = %s", (email,)
        ).fetchone()
        if not user or not verify_password(req.password, user["password_hash"]):
            raise HTTPException(status_code=400, detail="Email hoặc mật khẩu không đúng.")

        token = secrets.token_hex(32)
        conn.execute(
            "INSERT INTO sessions (token, user_id) VALUES (%s, %s)",
            (token, user["id"]),
        )

        return {
            "access_token": token,
            "user": {"id": user["id"], "name": user["name"], "email": user["email"]},
        }


@app.get("/auth/me")
def get_me(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Chưa đăng nhập.")

    token = authorization.split(" ", 1)[1]
    with get_db() as conn:
        session = conn.execute(
            "SELECT * FROM sessions WHERE token = %s", (token,)
        ).fetchone()
        if not session:
            raise HTTPException(status_code=401, detail="Phiên đăng nhập không hợp lệ.")

        user = conn.execute(
            "SELECT * FROM users WHERE id = %s", (session["user_id"],)
        ).fetchone()
        return {"user": {"id": user["id"], "name": user["name"], "email": user["email"]}}


@app.post("/auth/logout")
def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        with get_db() as conn:
            conn.execute("DELETE FROM sessions WHERE token = %s", (token,))
    return {"message": "Đăng xuất thành công."}


@app.get("/health")
def health():
    try:
        with get_db() as conn:
            conn.execute("SELECT 1")
    except OperationalError as exc:
        raise HTTPException(status_code=503, detail="Không kết nối được database Postgres.") from exc

    return {"status": "ok", "database": "postgres"}


# ── Khởi động server ──────────────────────────────────
def find_free_port(start: int = 8000) -> int:
    """Tìm cổng trống bắt đầu từ `start`."""
    port = start
    while port < 9000:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return port
        port += 1
    return start


if __name__ == "__main__":
    import uvicorn

    port = find_free_port(8000)
    if port != 8000:
        print(f"⚠️  Cổng 8000 đang bận, chuyển sang cổng {port}")
    print(f"🚀  Backend KidLearn đang chạy tại http://localhost:{port}")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
