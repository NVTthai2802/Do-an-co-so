import hashlib
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import quote

from fastapi import APIRouter, Header, HTTPException, Request

from app.core.config import get_app_base_url
from app.core.security import hash_password, verify_password
from app.db.connection import get_db
from app.schemas.auth import (
    ForgotPasswordReq,
    LoginReq,
    RegisterReq,
    ResetPasswordReq,
    VerifyPasswordReq,
)
from app.services.auth_security import (
    PARENTAL_GATE_LIMIT,
    PARENTAL_GATE_LOCK_MINUTES,
    PARENTAL_GATE_SCOPE,
    RESET_SCOPE_EMAIL,
    RESET_SCOPE_IP,
    RESET_REQUEST_LIMIT,
    RESET_REQUEST_LOCK_MINUTES,
    assert_login_not_locked,
    assert_throttle_not_locked,
    clear_login_throttle,
    clear_throttle,
    get_client_ip,
    record_login_failure,
    record_throttle_failure,
)
from app.services.users import public_user


router = APIRouter(prefix="/auth", tags=["auth"])

PASSWORD_RESET_TOKEN_TTL_MINUTES = 30
MIN_PASSWORD_LENGTH = 10


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _hash_value(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _make_token() -> str:
    return secrets.token_urlsafe(32)


def _issue_session(conn, user_id: int) -> str:
    token = secrets.token_hex(32)
    conn.execute(
        "INSERT INTO sessions (token, user_id) VALUES (%s, %s)",
        (token, user_id),
    )
    return token


def _load_user_by_email(conn, email: str):
    return conn.execute(
        "SELECT * FROM users WHERE email = %s",
        (email,),
    ).fetchone()


def _load_reset_token(conn, reset_token: str):
    return conn.execute(
        """
        SELECT t.*, u.email, u.name, u.id AS user_id
        FROM password_reset_tokens t
        JOIN users u ON u.id = t.user_id
        WHERE t.token_hash = %s
        """,
        (_hash_value(reset_token),),
    ).fetchone()


def _reset_url(reset_token: str) -> str:
    base = get_app_base_url().rstrip("/")
    return f"{base}/reset-password?token={quote(reset_token)}"


def _store_reset_token(conn, user_id: int) -> str:
    raw_token = _make_token()
    token_hash = _hash_value(raw_token)
    expires_at = _now() + timedelta(minutes=PASSWORD_RESET_TOKEN_TTL_MINUTES)
    conn.execute(
        "DELETE FROM password_reset_tokens WHERE user_id = %s AND used_at IS NULL",
        (user_id,),
    )
    conn.execute(
        """
        INSERT INTO password_reset_tokens (token_hash, user_id, expires_at)
        VALUES (%s, %s, %s)
        """,
        (token_hash, user_id, expires_at),
    )
    return raw_token


def _validate_password_strength(password: str):
    if len(password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Mat khau phai co it nhat {MIN_PASSWORD_LENGTH} ky tu.",
        )

    if not re.search(r"[a-z]", password):
        raise HTTPException(status_code=400, detail="Mat khau phai co chu thuong.")

    if not re.search(r"[A-Z]", password):
        raise HTTPException(status_code=400, detail="Mat khau phai co chu hoa.")

    if not re.search(r"\d", password):
        raise HTTPException(status_code=400, detail="Mat khau phai co so.")

    if not re.search(r"[^A-Za-z0-9]", password):
        raise HTTPException(
            status_code=400,
            detail="Mat khau phai co ky tu dac biet.",
        )

    if re.search(r"\s", password):
        raise HTTPException(status_code=400, detail="Mat khau khong duoc chua khoang trang.")


def _get_session_user(conn, authorization: Optional[str]):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Chua dang nhap.")

    token = authorization.split(" ", 1)[1]
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

    return token, user


@router.post("/register")
def register(req: RegisterReq):
    email = req.email.strip().lower()
    name = req.name.strip()
    password = req.password
    confirm_password = req.confirm_password

    if not name:
        raise HTTPException(status_code=400, detail="Vui long nhap ho va ten.")

    if password != confirm_password:
        raise HTTPException(status_code=400, detail="Mat khau xac nhan khong khop.")

    _validate_password_strength(password)

    with get_db() as conn:
        existing = conn.execute(
            "SELECT id FROM users WHERE email = %s",
            (email,),
        ).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="Email nay da duoc dang ky.")

        conn.execute(
            """
            INSERT INTO users (name, email, password_hash)
            VALUES (%s, %s, %s)
            """,
            (name, email, hash_password(password)),
        )
        user = _load_user_by_email(conn, email)
        token = _issue_session(conn, user["id"])

        return {
            "message": "Da tao tai khoan thanh cong.",
            "access_token": token,
            "user": public_user(user),
        }


@router.post("/login")
def login(req: LoginReq, request: Request):
    email = req.email.strip().lower()
    ip_address = get_client_ip(request)

    with get_db() as conn:
        assert_login_not_locked(conn, email, ip_address)

        user = _load_user_by_email(conn, email)
        password_hash = user.get("password_hash") if user else None
        if not user or not password_hash or not verify_password(req.password, password_hash):
            lock_triggered = record_login_failure(conn, email, ip_address)
            raise HTTPException(
                status_code=429 if lock_triggered else 400,
                detail=(
                    "Ban da thu qua nhieu lan. Hay thu lai sau."
                    if lock_triggered
                    else "Email hoac mat khau khong dung."
                ),
            )

        clear_login_throttle(conn, email=email, ip_address=ip_address)
        token = _issue_session(conn, user["id"])
        return {
            "access_token": token,
            "user": public_user(user),
        }


@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordReq, request: Request):
    email = req.email.strip().lower()
    ip_address = get_client_ip(request)
    response = {
        "message": "Neu email ton tai, chung toi da tao lien ket dat lai mat khau.",
    }

    with get_db() as conn:
        assert_throttle_not_locked(
            conn,
            RESET_SCOPE_EMAIL,
            email,
            "Ban da yeu cau dat lai mat khau qua nhieu lan. Hay thu lai sau.",
        )
        assert_throttle_not_locked(
            conn,
            RESET_SCOPE_IP,
            ip_address,
            "Ban da yeu cau dat lai mat khau qua nhieu lan. Hay thu lai sau.",
        )

        user = _load_user_by_email(conn, email)
        if user:
            reset_token = _store_reset_token(conn, user["id"])
            response["reset_url"] = _reset_url(reset_token)

        record_throttle_failure(
            conn,
            RESET_SCOPE_EMAIL,
            email,
            RESET_REQUEST_LIMIT,
            RESET_REQUEST_LOCK_MINUTES,
        )
        record_throttle_failure(
            conn,
            RESET_SCOPE_IP,
            ip_address,
            RESET_REQUEST_LIMIT,
            RESET_REQUEST_LOCK_MINUTES,
        )

        return response


@router.post("/reset-password")
def reset_password(req: ResetPasswordReq, request: Request):
    password = req.password
    confirm_password = req.confirm_password
    if password != confirm_password:
        raise HTTPException(status_code=400, detail="Mat khau xac nhan khong khop.")

    _validate_password_strength(password)

    with get_db() as conn:
        token_row = _load_reset_token(conn, req.token.strip())
        if (
            not token_row
            or token_row["used_at"] is not None
            or token_row["expires_at"] <= _now()
        ):
            raise HTTPException(
                status_code=400,
                detail="Lien ket dat lai da het han hoac khong hop le.",
            )

        new_password_hash = hash_password(password)
        conn.execute(
            """
            UPDATE users
            SET password_hash = %s
            WHERE id = %s
            """,
            (new_password_hash, token_row["user_id"]),
        )
        conn.execute(
            "UPDATE password_reset_tokens SET used_at = %s WHERE token_hash = %s",
            (_now(), token_row["token_hash"]),
        )
        conn.execute("DELETE FROM sessions WHERE user_id = %s", (token_row["user_id"],))
        clear_login_throttle(conn, email=token_row["email"], ip_address=get_client_ip(request))
        clear_throttle(conn, RESET_SCOPE_EMAIL, token_row["email"])
        clear_throttle(conn, RESET_SCOPE_IP, get_client_ip(request))

        return {"message": "Mat khau da duoc dat lai thanh cong."}


@router.get("/me")
def get_me(authorization: Optional[str] = Header(None)):
    with get_db() as conn:
        _, user = _get_session_user(conn, authorization)
        return {"user": public_user(user)}


@router.post("/verify-password")
def verify_password_endpoint(req: VerifyPasswordReq, authorization: Optional[str] = Header(None)):
    """Re-check the current user's password without issuing a new session.

    Used by the Parental Gate on /hoc-tap so a child cannot switch back to the
    parent dashboard without a grown-up re-entering the account password.
    """
    with get_db() as conn:
        _, user = _get_session_user(conn, authorization)
        identifier = str(user["id"])

        assert_throttle_not_locked(
            conn,
            PARENTAL_GATE_SCOPE,
            identifier,
            "Ban da nhap sai qua nhieu lan. Hay thu lai sau 30 giay.",
        )

        password_hash = user.get("password_hash")
        if not password_hash or not verify_password(req.password, password_hash):
            lock_triggered = record_throttle_failure(
                conn,
                PARENTAL_GATE_SCOPE,
                identifier,
                PARENTAL_GATE_LIMIT,
                PARENTAL_GATE_LOCK_MINUTES,
            )
            raise HTTPException(
                status_code=429 if lock_triggered else 400,
                detail=(
                    "Ban da nhap sai qua nhieu lan. Hay thu lai sau 30 giay."
                    if lock_triggered
                    else "Mat khau khong dung."
                ),
            )

        clear_throttle(conn, PARENTAL_GATE_SCOPE, identifier)
        return {"message": "Xac thuc thanh cong."}


@router.post("/logout")
def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        with get_db() as conn:
            conn.execute("DELETE FROM sessions WHERE token = %s", (token,))
    return {"message": "Dang xuat thanh cong."}
