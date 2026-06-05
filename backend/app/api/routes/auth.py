import hashlib
import hmac
import os
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
    ResendOtpReq,
    ResetPasswordReq,
    VerifyOtpReq,
)
from app.services.auth_security import (
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
from app.services.mail import (
    email_delivery_is_configured,
    send_password_reset_email,
    send_verification_email,
)
from app.services.users import public_user


router = APIRouter(prefix="/auth", tags=["auth"])

OTP_TTL_MINUTES = 10
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_COOLDOWN_SECONDS = 60
VERIFICATION_TOKEN_TTL_HOURS = 24
PASSWORD_RESET_TOKEN_TTL_MINUTES = 30


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _hash_value(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _make_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _make_token() -> str:
    return secrets.token_urlsafe(32)


def _is_production_like() -> bool:
    return os.getenv("VERCEL") == "1" or os.getenv("NODE_ENV", "").strip().lower() == "production"


def _email_config_error(message: str) -> HTTPException:
    return HTTPException(status_code=503, detail=message)


def _deliver_verification_email(to_email: str, name: str, otp_code: str, verify_url: str) -> bool:
    if not email_delivery_is_configured():
        if _is_production_like():
            raise _email_config_error(
                "He thong gui email chua duoc cau hinh. Hay thiet lap RESEND hoac SMTP."
            )
        return False

    try:
        send_verification_email(to_email, name, otp_code, verify_url)
    except Exception as exc:
        if _is_production_like():
            raise _email_config_error(
                "Khong the gui email xac minh. Hay thu lai sau."
            ) from exc
        return False

    return True


def _deliver_password_reset_email(to_email: str, name: str, reset_url: str) -> bool:
    if not email_delivery_is_configured():
        if _is_production_like():
            raise _email_config_error(
                "He thong gui email chua duoc cau hinh. Hay thiet lap RESEND hoac SMTP."
            )
        return False

    try:
        send_password_reset_email(to_email, name, reset_url)
    except Exception as exc:
        if _is_production_like():
            raise _email_config_error(
                "Khong the gui email dat lai mat khau. Hay thu lai sau."
            ) from exc
        return False

    return True


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


def _load_user_by_verification_token(conn, verification_token: str):
    return conn.execute(
        "SELECT * FROM users WHERE verification_token_hash = %s",
        (_hash_value(verification_token),),
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


def _verification_url(email: str, verification_token: str) -> str:
    base = get_app_base_url().rstrip("/")
    return f"{base}/verify-otp?token={quote(verification_token)}&email={quote(email)}"


def _reset_url(reset_token: str) -> str:
    base = get_app_base_url().rstrip("/")
    return f"{base}/reset-password?token={quote(reset_token)}"


def _issue_verification_token(conn, user_id: int) -> str:
    verification_token = _make_token()
    token_expires_at = _now() + timedelta(hours=VERIFICATION_TOKEN_TTL_HOURS)
    conn.execute(
        """
        UPDATE users
        SET verification_token_hash = %s,
            verification_token_expires_at = %s
        WHERE id = %s
        """,
        (_hash_value(verification_token), token_expires_at, user_id),
    )
    return verification_token


def _issue_verification_code(conn, user_id: int) -> str:
    otp_code = _make_otp()
    otp_expires_at = _now() + timedelta(minutes=OTP_TTL_MINUTES)
    conn.execute(
        """
        UPDATE users
        SET verification_code_hash = %s,
            verification_code_expires_at = %s,
            verification_code_sent_at = %s,
            verification_attempts = 0,
            verification_locked_until = NULL,
            is_verified = FALSE
        WHERE id = %s
        """,
        (_hash_value(otp_code), otp_expires_at, _now(), user_id),
    )
    return otp_code


def _otp_resend_remaining_seconds(user) -> int:
    sent_at = user.get("verification_code_sent_at")
    if not sent_at:
        return 0

    elapsed = (_now() - sent_at).total_seconds()
    return max(0, OTP_RESEND_COOLDOWN_SECONDS - int(elapsed))


def _verification_code_remaining_seconds(user) -> int:
    expires_at = user.get("verification_code_expires_at")
    if not expires_at:
        return 0

    remaining = int((expires_at - _now()).total_seconds())
    return max(0, remaining)


def _reset_lock_if_expired(conn, user):
    locked_until = user.get("verification_locked_until")
    if locked_until and locked_until <= _now():
        conn.execute(
            """
            UPDATE users
            SET verification_attempts = 0,
                verification_locked_until = NULL
            WHERE id = %s
            """,
            (user["id"],),
        )
        user["verification_attempts"] = 0
        user["verification_locked_until"] = None


def _verification_locked(user) -> bool:
    locked_until = user.get("verification_locked_until")
    return bool(locked_until and locked_until > _now())


def _verification_token_valid(user, verification_token: str) -> bool:
    token_hash = _hash_value(verification_token)
    if not hmac.compare_digest(token_hash, user.get("verification_token_hash") or ""):
        return False

    expires_at = user.get("verification_token_expires_at")
    return bool(expires_at and expires_at > _now())


def _otp_valid(user) -> bool:
    code_hash = user.get("verification_code_hash")
    expires_at = user.get("verification_code_expires_at")
    return bool(code_hash and expires_at and expires_at > _now())


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

    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Mat khau phai co it nhat 8 ky tu.")

    with get_db() as conn:
        existing = conn.execute(
            "SELECT id, is_verified FROM users WHERE email = %s",
            (email,),
        ).fetchone()
        if existing and existing["is_verified"]:
            raise HTTPException(status_code=400, detail="Email nay da duoc dang ky.")

        password_hash = hash_password(password)
        if existing and not existing["is_verified"]:
            conn.execute(
                """
                UPDATE users
                SET name = %s,
                    password_hash = %s
                WHERE id = %s
                """,
                (name, password_hash, existing["id"]),
            )
            user_id = existing["id"]
        else:
            conn.execute(
                """
                INSERT INTO users (name, email, password_hash, is_verified)
                VALUES (%s, %s, %s, FALSE)
                """,
                (name, email, password_hash),
            )
            user_id = conn.execute(
                "SELECT id FROM users WHERE email = %s",
                (email,),
            ).fetchone()["id"]

        verification_token = _issue_verification_token(conn, user_id)
        otp_code = _issue_verification_code(conn, user_id)
        verify_url = _verification_url(email, verification_token)
        email_sent = _deliver_verification_email(email, name, otp_code, verify_url)

        response = {
            "message": "Da tao tai khoan. Hay kiem tra email de xac minh OTP.",
            "requires_verification": True,
            "email": email,
            "verification_token": verification_token,
            "verification_url": verify_url,
            "resend_after_seconds": OTP_RESEND_COOLDOWN_SECONDS,
            "otp_expires_in_seconds": OTP_TTL_MINUTES * 60,
        }
        if not email_sent:
            response["development_otp"] = otp_code
            response["message"] = (
                "Da tao tai khoan. Email chua cau hinh nen OTP duoc tra ve trong ung dung."
            )
        return response


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

        if user["is_verified"]:
            clear_login_throttle(conn, email=email, ip_address=ip_address)
            token = _issue_session(conn, user["id"])
            return {
                "access_token": token,
                "user": public_user(user),
            }

        _reset_lock_if_expired(conn, user)
        if _verification_locked(user):
            raise HTTPException(
                status_code=429,
                detail="Tai khoan tam bi khoa, vui long thu lai sau.",
            )

        verification_token = _issue_verification_token(conn, user["id"])
        resend_after_seconds = _otp_resend_remaining_seconds(user)
        otp_sent = False
        development_otp = ""
        verify_url = _verification_url(email, verification_token)
        otp_expires_in_seconds = _verification_code_remaining_seconds(user) or OTP_TTL_MINUTES * 60

        if email_delivery_is_configured():
            if not _otp_valid(user):
                otp_code = _issue_verification_code(conn, user["id"])
                otp_sent = _deliver_verification_email(email, user["name"], otp_code, verify_url)
                resend_after_seconds = OTP_RESEND_COOLDOWN_SECONDS
                otp_expires_in_seconds = OTP_TTL_MINUTES * 60
                if not otp_sent and not _is_production_like():
                    development_otp = otp_code
        else:
            if _is_production_like():
                raise _email_config_error(
                    "He thong gui email chua duoc cau hinh. Hay thiet lap RESEND hoac SMTP."
                )
            otp_code = _issue_verification_code(conn, user["id"])
            development_otp = otp_code
            resend_after_seconds = OTP_RESEND_COOLDOWN_SECONDS
            otp_expires_in_seconds = OTP_TTL_MINUTES * 60

        clear_login_throttle(conn, email=email, ip_address=ip_address)
        response = {
            "requires_verification": True,
            "message": "Tai khoan chua duoc xac minh OTP.",
            "email": email,
            "verification_token": verification_token,
            "verification_url": verify_url,
            "resend_after_seconds": resend_after_seconds,
            "otp_expires_in_seconds": otp_expires_in_seconds,
            "otp_sent": otp_sent,
        }
        if development_otp:
            response["development_otp"] = development_otp
            response["message"] = (
                "Tai khoan chua duoc xac minh OTP. Email chua cau hinh nen OTP duoc tra ve trong ung dung."
            )
        return response


@router.post("/verify-otp")
def verify_otp(req: VerifyOtpReq, request: Request):
    code = req.code.strip()
    verification_token = req.verification_token.strip()
    if len(code) != 6 or not code.isdigit():
        raise HTTPException(status_code=400, detail="OTP khong hop le.")

    with get_db() as conn:
        user = _load_user_by_verification_token(conn, verification_token)
        if not user:
            raise HTTPException(
                status_code=400,
                detail="Lien ket xac minh khong hop le hoac da het han.",
            )

        if user["is_verified"]:
            raise HTTPException(status_code=400, detail="Tai khoan da duoc xac minh. Hay dang nhap.")

        _reset_lock_if_expired(conn, user)
        if _verification_locked(user):
            raise HTTPException(
                status_code=429,
                detail="Tai khoan tam bi khoa, vui long thu lai sau.",
            )

        if not _verification_token_valid(user, verification_token):
            raise HTTPException(
                status_code=400,
                detail="Lien ket xac minh da het han. Hay dang nhap lai de lay ma moi.",
            )

        if not _otp_valid(user):
            raise HTTPException(
                status_code=400,
                detail="Ma OTP da het han. Hay yeu cau gui lai.",
            )

        if not hmac.compare_digest(_hash_value(code), user["verification_code_hash"]):
            attempts = int(user.get("verification_attempts") or 0) + 1
            locked_until = _now() + timedelta(minutes=15) if attempts >= OTP_MAX_ATTEMPTS else None
            conn.execute(
                """
                UPDATE users
                SET verification_attempts = %s,
                    verification_locked_until = %s
                WHERE id = %s
                """,
                (attempts, locked_until, user["id"]),
            )
            raise HTTPException(
                status_code=429 if locked_until else 400,
                detail=(
                    "Tai khoan tam bi khoa, vui long thu lai sau."
                    if locked_until
                    else "Email hoac OTP khong dung."
                ),
            )

        conn.execute(
            """
            UPDATE users
            SET is_verified = TRUE,
                verification_token_hash = NULL,
                verification_token_expires_at = NULL,
                verification_code_hash = NULL,
                verification_code_expires_at = NULL,
                verification_code_sent_at = NULL,
                verification_attempts = 0,
                verification_locked_until = NULL
            WHERE id = %s
            """,
            (user["id"],),
        )
        clear_login_throttle(conn, email=user["email"], ip_address=get_client_ip(request))
        token = _issue_session(conn, user["id"])
        user = _load_user_by_email(conn, user["email"])
        return {"access_token": token, "user": public_user(user)}


@router.post("/resend-otp")
def resend_otp(req: ResendOtpReq):
    verification_token = req.verification_token.strip()
    with get_db() as conn:
        user = _load_user_by_verification_token(conn, verification_token)
        if not user:
            raise HTTPException(
                status_code=400,
                detail="Lien ket xac minh khong hop le hoac da het han.",
            )
        if user["is_verified"]:
            raise HTTPException(status_code=400, detail="Tai khoan da duoc xac minh.")

        _reset_lock_if_expired(conn, user)
        if _verification_locked(user):
            raise HTTPException(
                status_code=429,
                detail="Tai khoan tam bi khoa, vui long thu lai sau.",
            )

        resend_remaining = _otp_resend_remaining_seconds(user)
        if resend_remaining > 0:
            raise HTTPException(
                status_code=429,
                detail=f"Hay doi {resend_remaining} giay truoc khi gui lai OTP.",
            )

        conn.execute(
            """
            UPDATE users
            SET verification_token_expires_at = %s
            WHERE id = %s
            """,
            (_now() + timedelta(hours=VERIFICATION_TOKEN_TTL_HOURS), user["id"]),
        )
        otp_code = _issue_verification_code(conn, user["id"])
        verify_url = _verification_url(user["email"], verification_token)
        email_sent = _deliver_verification_email(
            user["email"], user["name"], otp_code, verify_url
        )
        response = {
            "message": "Da gui lai ma OTP vao email cua ban.",
            "resend_after_seconds": OTP_RESEND_COOLDOWN_SECONDS,
            "otp_expires_in_seconds": OTP_TTL_MINUTES * 60,
        }
        if not email_sent:
            response["development_otp"] = otp_code
            response["message"] = (
                "Da tao ma OTP moi. Email chua cau hinh nen OTP duoc tra ve trong ung dung."
            )
        return response


@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordReq, request: Request):
    email = req.email.strip().lower()
    ip_address = get_client_ip(request)
    response = {
        "message": "Neu email ton tai, chung toi da gui lien ket dat lai mat khau.",
    }

    with get_db() as conn:
        # Use the shared throttle table to slow down password reset spam.
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
            reset_url = _reset_url(reset_token)
            email_sent = _deliver_password_reset_email(email, user["name"], reset_url)
            if not email_sent and not _is_production_like():
                response["message"] = "Neu email ton tai, chung toi da tao lien ket dat lai mat khau."
                response["development_reset_url"] = reset_url

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

    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Mat khau phai co it nhat 8 ky tu.")

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
            SET password_hash = %s,
                is_verified = TRUE,
                verification_token_hash = NULL,
                verification_token_expires_at = NULL,
                verification_code_hash = NULL,
                verification_code_expires_at = NULL,
                verification_code_sent_at = NULL,
                verification_attempts = 0,
                verification_locked_until = NULL
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
