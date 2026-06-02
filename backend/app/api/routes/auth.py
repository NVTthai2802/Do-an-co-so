import secrets
from typing import Optional

from fastapi import APIRouter, Header, HTTPException

from app.core.security import hash_password, verify_password
from app.db.connection import get_db
from app.schemas.auth import LoginReq, RegisterReq
from app.services.users import public_user


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register")
def register(req: RegisterReq):
    email = req.email.strip().lower()
    name = req.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Vui long nhap ho va ten.")

    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Mat khau phai co it nhat 6 ky tu.")

    with get_db() as conn:
        existing = conn.execute(
            "SELECT id FROM users WHERE email = %s",
            (email,),
        ).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="Email nay da duoc dang ky.")

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
            "user": public_user(user),
        }


@router.post("/login")
def login(req: LoginReq):
    email = req.email.strip().lower()
    with get_db() as conn:
        user = conn.execute(
            "SELECT * FROM users WHERE email = %s",
            (email,),
        ).fetchone()
        password_hash = user.get("password_hash") if user else None
        if user and not password_hash:
            password_hash = user.get("hashed_password")

        if not user or not password_hash or not verify_password(req.password, password_hash):
            raise HTTPException(status_code=400, detail="Email hoac mat khau khong dung.")

        token = secrets.token_hex(32)
        conn.execute(
            "INSERT INTO sessions (token, user_id) VALUES (%s, %s)",
            (token, user["id"]),
        )

        return {
            "access_token": token,
            "user": public_user(user),
        }


@router.get("/me")
def get_me(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Chua dang nhap.")

    token = authorization.split(" ", 1)[1]
    with get_db() as conn:
        session = conn.execute(
            "SELECT * FROM sessions WHERE token = %s",
            (token,),
        ).fetchone()
        if not session:
            raise HTTPException(status_code=401, detail="Phien dang nhap khong hop le.")

        user = conn.execute(
            "SELECT * FROM users WHERE id = %s",
            (session["user_id"],),
        ).fetchone()
        if not user:
            raise HTTPException(status_code=401, detail="Phien dang nhap khong hop le.")
        return {"user": public_user(user)}


@router.post("/logout")
def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        with get_db() as conn:
            conn.execute("DELETE FROM sessions WHERE token = %s", (token,))
    return {"message": "Dang xuat thanh cong."}
