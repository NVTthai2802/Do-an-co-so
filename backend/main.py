import os
import sqlite3
import secrets
import hashlib
from typing import Optional
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from database import get_db
from models import User, Lesson
from crud import create_user, get_lessons

app = FastAPI(title="KidLearn API")

# Cho phép Frontend kết nối tới Backend (Giải quyết lỗi CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Chuyển database vào /tmp/ để Vercel cấp quyền Ghi (Write)
DB_PATH = os.getenv("KIDLEARN_DATABASE_PATH", "/tmp/kidlearn.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# Tự động tạo bảng Database khi khởi động
@app.on_event("startup")
def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL
            )
        """)

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

# ===== ĐỊNH NGHĨA CÁC ĐẦU MỐI API =====

class RegisterReq(BaseModel):
    name: str
    email: str
    password: str

@app.post("/auth/register")
def register(req: RegisterReq):
    with get_db() as conn:
        # Kiểm tra trùng email
        user = conn.execute("SELECT * FROM users WHERE email = ?", (req.email,)).fetchone()
        if user:
            raise HTTPException(400, "Email này đã được đăng ký.")
        
        # Thêm user mới
        pwd_hash = hash_password(req.password)
        cur = conn.execute("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)", 
                           (req.name, req.email, pwd_hash))
        user_id = cur.lastrowid
        
        # Tạo phiên đăng nhập (Token)
        token = secrets.token_hex(32)
        conn.execute("INSERT INTO sessions (token, user_id) VALUES (?, ?)", (token, user_id))
        
        return {
            "access_token": token,
            "user": {"id": user_id, "name": req.name, "email": req.email}
        }

class LoginReq(BaseModel):
    email: str
    password: str

@app.post("/auth/login")
def login(req: LoginReq):
    with get_db() as conn:
        user = conn.execute("SELECT * FROM users WHERE email = ?", (req.email,)).fetchone()
        if not user or user["password_hash"] != hash_password(req.password):
            raise HTTPException(400, "Email hoặc mật khẩu không đúng.")
        
        token = secrets.token_hex(32)
        conn.execute("INSERT INTO sessions (token, user_id) VALUES (?, ?)", (token, user["id"]))
        
        return {
            "access_token": token,
            "user": {"id": user["id"], "name": user["name"], "email": user["email"]}
        }

@app.get("/auth/me")
def get_me(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Chưa đăng nhập.")
    
    token = authorization.split(" ")[1]
    with get_db() as conn:
        session = conn.execute("SELECT * FROM sessions WHERE token = ?", (token,)).fetchone()
        if not session:
            raise HTTPException(401, "Phiên đăng nhập không hợp lệ.")
        
        user = conn.execute("SELECT * FROM users WHERE id = ?", (session["user_id"],)).fetchone()
        return {"user": {"id": user["id"], "name": user["name"], "email": user["email"]}}

@app.post("/auth/logout")
def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        with get_db() as conn:
            conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
    return {"message": "Đăng xuất thành công."}

@app.get("/health")
def health():
    return {"status": "ok"}