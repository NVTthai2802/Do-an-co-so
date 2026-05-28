import os
import sqlite3
import secrets
import hashlib
import socket
from typing import Optional
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="KidLearn API")

# ── Đọc cấu hình từ .env ──────────────────────────────
DB_PATH = os.getenv("KIDLEARN_DATABASE_PATH", "./kidlearn.db")
CORS_ORIGINS = os.getenv(
    "KIDLEARN_CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000"
).split(",")

# ── CORS ─────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Database helpers ──────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@app.on_event("startup")
def init_db():
    """Tự động tạo bảng khi server khởi động."""
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                name          TEXT NOT NULL,
                email         TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                token   TEXT    PRIMARY KEY,
                user_id INTEGER NOT NULL
            )
        """)


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


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
    with get_db() as conn:
        existing = conn.execute(
            "SELECT id FROM users WHERE email = ?", (req.email,)
        ).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="Email này đã được đăng ký.")

        pwd_hash = hash_password(req.password)
        cur = conn.execute(
            "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
            (req.name, req.email, pwd_hash),
        )
        user_id = cur.lastrowid

        token = secrets.token_hex(32)
        conn.execute(
            "INSERT INTO sessions (token, user_id) VALUES (?, ?)", (token, user_id)
        )

        return {
            "access_token": token,
            "user": {"id": user_id, "name": req.name, "email": req.email},
        }


@app.post("/auth/login")
def login(req: LoginReq):
    with get_db() as conn:
        user = conn.execute(
            "SELECT * FROM users WHERE email = ?", (req.email,)
        ).fetchone()
        if not user or user["password_hash"] != hash_password(req.password):
            raise HTTPException(status_code=400, detail="Email hoặc mật khẩu không đúng.")

        token = secrets.token_hex(32)
        conn.execute(
            "INSERT INTO sessions (token, user_id) VALUES (?, ?)", (token, user["id"])
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
            "SELECT * FROM sessions WHERE token = ?", (token,)
        ).fetchone()
        if not session:
            raise HTTPException(status_code=401, detail="Phiên đăng nhập không hợp lệ.")

        user = conn.execute(
            "SELECT * FROM users WHERE id = ?", (session["user_id"],)
        ).fetchone()
        return {"user": {"id": user["id"], "name": user["name"], "email": user["email"]}}


@app.post("/auth/logout")
def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        with get_db() as conn:
            conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
    return {"message": "Đăng xuất thành công."}


@app.get("/health")
def health():
    return {"status": "ok"}


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