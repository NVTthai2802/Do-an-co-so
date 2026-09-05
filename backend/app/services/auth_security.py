from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request


LOGIN_FAILURE_LIMIT = 5
LOGIN_LOCK_MINUTES = 15
THROTTLE_SCOPE_EMAIL = "login_email"
THROTTLE_SCOPE_IP = "login_ip"
RESET_SCOPE_EMAIL = "reset_email"
RESET_SCOPE_IP = "reset_ip"
RESET_REQUEST_LIMIT = 3
RESET_REQUEST_LOCK_MINUTES = 30
PARENTAL_GATE_SCOPE = "parental_gate"
PARENTAL_GATE_LIMIT = 5
PARENTAL_GATE_LOCK_MINUTES = 0.5


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "").strip()
    if forwarded_for:
        candidate = forwarded_for.split(",", 1)[0].strip()
        if candidate:
            return candidate

    real_ip = request.headers.get("x-real-ip", "").strip()
    if real_ip:
        return real_ip

    if request.client and request.client.host:
        return request.client.host

    return "unknown"


def _load_throttle(conn, scope: str, identifier: str):
    return conn.execute(
        """
        SELECT scope, identifier, failure_count, locked_until
        FROM auth_throttles
        WHERE scope = %s AND identifier = %s
        """,
        (scope, identifier),
    ).fetchone()


def is_locked(row) -> bool:
    return bool(row and row["locked_until"] and row["locked_until"] > now_utc())


def assert_throttle_not_locked(
    conn,
    scope: str,
    identifier: str,
    detail: str = "Ban da thu qua nhieu lan. Hay thu lai sau.",
) -> None:
    row = _load_throttle(conn, scope, identifier)
    if is_locked(row):
        raise HTTPException(status_code=429, detail=detail)


def assert_login_not_locked(conn, email: str, ip_address: str) -> None:
    assert_throttle_not_locked(conn, THROTTLE_SCOPE_EMAIL, email)
    assert_throttle_not_locked(conn, THROTTLE_SCOPE_IP, ip_address)


def clear_throttle(conn, scope: str, identifier: str) -> None:
    conn.execute(
        """
        DELETE FROM auth_throttles
        WHERE scope = %s AND identifier = %s
        """,
        (scope, identifier),
    )


def clear_login_throttle(
    conn,
    email: str | None = None,
    ip_address: str | None = None,
) -> None:
    targets = []
    if email:
        targets.append((THROTTLE_SCOPE_EMAIL, email))
    if ip_address:
        targets.append((THROTTLE_SCOPE_IP, ip_address))

    for scope, identifier in targets:
        clear_throttle(conn, scope, identifier)


def record_throttle_failure(
    conn,
    scope: str,
    identifier: str,
    limit: int,
    lock_minutes: int,
) -> bool:
    now = now_utc()
    row = _load_throttle(conn, scope, identifier)
    current_count = int(row["failure_count"]) if row else 0
    if row and row["locked_until"] and row["locked_until"] <= now:
        current_count = 0

    new_count = current_count + 1
    locked_until = now + timedelta(minutes=lock_minutes) if new_count >= limit else None
    conn.execute(
        """
        INSERT INTO auth_throttles (
            scope,
            identifier,
            failure_count,
            locked_until,
            last_failure_at,
            updated_at
        )
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (scope, identifier)
        DO UPDATE SET
            failure_count = EXCLUDED.failure_count,
            locked_until = EXCLUDED.locked_until,
            last_failure_at = EXCLUDED.last_failure_at,
            updated_at = EXCLUDED.updated_at
        """,
        (scope, identifier, new_count, locked_until, now, now),
    )
    return locked_until is not None


def record_login_failure(conn, email: str, ip_address: str) -> bool:
    lock_triggered = record_throttle_failure(
        conn,
        THROTTLE_SCOPE_EMAIL,
        email,
        LOGIN_FAILURE_LIMIT,
        LOGIN_LOCK_MINUTES,
    )
    ip_locked = record_throttle_failure(
        conn,
        THROTTLE_SCOPE_IP,
        ip_address,
        LOGIN_FAILURE_LIMIT,
        LOGIN_LOCK_MINUTES,
    )
    return lock_triggered or ip_locked
