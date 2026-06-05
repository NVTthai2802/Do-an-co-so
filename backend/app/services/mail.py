import json
import smtplib
from email.message import EmailMessage
from urllib import error, request

from app.core.config import get_email_delivery_config


def email_delivery_is_configured() -> bool:
    cfg = get_email_delivery_config()
    provider = cfg["provider"]
    if provider == "resend":
        return bool(cfg["resend_api_key"] and cfg["resend_from"])

    return bool(
        cfg["smtp_host"]
        and cfg["smtp_from"]
        and cfg["smtp_user"]
        and cfg["smtp_password"]
    )


def _build_message(subject: str, sender: str, to_email: str, body_text: str) -> EmailMessage:
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = sender
    message["To"] = to_email
    message.set_content(body_text)
    return message


def _send_via_smtp(to_email: str, subject: str, body_text: str) -> None:
    cfg = get_email_delivery_config()
    message = _build_message(subject, cfg["smtp_from"], to_email, body_text)

    with smtplib.SMTP(cfg["smtp_host"], cfg["smtp_port"]) as smtp:
        if cfg["smtp_use_tls"]:
            smtp.starttls()
        smtp.login(cfg["smtp_user"], cfg["smtp_password"])
        smtp.send_message(message)


def _send_via_resend(to_email: str, subject: str, body_text: str) -> None:
    cfg = get_email_delivery_config()
    payload = {
        "from": cfg["resend_from"],
        "to": [to_email],
        "subject": subject,
        "text": body_text,
    }
    body = json.dumps(payload).encode("utf-8")
    req = request.Request(
        "https://api.resend.com/emails",
        data=body,
        headers={
            "Authorization": f"Bearer {cfg['resend_api_key']}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=15) as response:
            response.read()
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Resend tra ve loi {exc.code}: {detail}") from exc
    except error.URLError as exc:
        raise RuntimeError(f"Khong ket noi duoc toi Resend: {exc.reason}") from exc


def _send_email(to_email: str, subject: str, body_text: str) -> None:
    cfg = get_email_delivery_config()
    provider = cfg["provider"]

    if provider == "resend":
        if not cfg["resend_api_key"] or not cfg["resend_from"]:
            raise RuntimeError("RESEND_API_KEY/RESEND_FROM chua duoc cau hinh.")
        _send_via_resend(to_email, subject, body_text)
        return

    if not cfg["smtp_host"] or not cfg["smtp_from"] or not cfg["smtp_user"] or not cfg["smtp_password"]:
        raise RuntimeError("SMTP chua duoc cau hinh.")

    _send_via_smtp(to_email, subject, body_text)


def send_verification_email(to_email: str, name: str, code: str, verify_url: str) -> None:
    body_text = (
        f"Xin chao {name},\n\n"
        f"Ma OTP xac minh tai khoan cua ban la: {code}\n"
        "Ma nay het han sau 10 phut.\n"
        f"Mo lien ket nay de xac minh: {verify_url}\n\n"
        "Neu ban khong tao tai khoan nay, hay bo qua email nay."
    )
    _send_email(to_email, "Ma OTP xac minh tai khoan KidLearn", body_text)


def send_password_reset_email(to_email: str, name: str, reset_url: str) -> None:
    body_text = (
        f"Xin chao {name},\n\n"
        "Ban vua yeu cau dat lai mat khau cho tai khoan KidLearn.\n"
        f"Mo lien ket nay de dat lai mat khau: {reset_url}\n"
        "Lien ket nay het han sau 30 phut.\n\n"
        "Neu ban khong yeu cau dat lai mat khau, hay bo qua email nay."
    )
    _send_email(to_email, "Dat lai mat khau KidLearn", body_text)
