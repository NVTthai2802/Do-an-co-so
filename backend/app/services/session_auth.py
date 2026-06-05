from fastapi import HTTPException


def get_session_user(conn, authorization: str | None):
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

