def row_value(row, key, fallback_index=0):
    try:
        return row[key]
    except (KeyError, TypeError):
        return row[fallback_index]


def get_table_columns(conn, table_name: str) -> set[str]:
    rows = conn.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s
        """,
        (table_name,),
    ).fetchall()
    return {row_value(row, "column_name") for row in rows}


def drop_not_null_if_exists(conn, table_name: str, column_name: str):
    if column_name in get_table_columns(conn, table_name):
        conn.execute(
            f"ALTER TABLE {table_name} ALTER COLUMN {column_name} DROP NOT NULL"
        )


def has_single_column_unique_index(conn, table_name: str, column_name: str) -> bool:
    return conn.execute(
        """
        SELECT 1
        FROM pg_index i
        JOIN pg_class t ON t.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
        WHERE n.nspname = 'public'
          AND t.relname = %s
          AND a.attname = %s
          AND i.indisunique
          AND i.indnatts = 1
        LIMIT 1
        """,
        (table_name, column_name),
    ).fetchone() is not None


def create_unique_index_if_missing(
    conn,
    table_name: str,
    index_name: str,
    column_name: str,
    predicate: str = "",
):
    if not has_single_column_unique_index(conn, table_name, column_name):
        where_clause = f" {predicate}" if predicate else ""
        conn.execute(
            f"CREATE UNIQUE INDEX IF NOT EXISTS {index_name} "
            f"ON {table_name} ({column_name}){where_clause}"
        )


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
    conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT")
    conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT")
    conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT")
    conn.execute("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    """)

    user_columns = get_table_columns(conn, "users")
    name_sources = ["NULLIF(name, '')"]
    if "full_name" in user_columns:
        name_sources.append("NULLIF(full_name, '')")
    if "username" in user_columns:
        name_sources.append("NULLIF(username, '')")
    name_sources.extend(["NULLIF(email, '')", "'User'"])
    conn.execute(
        f"""
        UPDATE users
        SET name = COALESCE({', '.join(name_sources)})
        WHERE name IS NULL OR name = ''
        """
    )

    if "hashed_password" in user_columns:
        conn.execute("""
            UPDATE users
            SET password_hash = hashed_password
            WHERE password_hash IS NULL AND hashed_password IS NOT NULL
        """)

    create_unique_index_if_missing(conn, "users", "users_email_unique_idx", "email")

    conn.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    conn.execute("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS token TEXT")
    conn.execute("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id BIGINT")
    conn.execute("""
        ALTER TABLE sessions
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    """)
    drop_not_null_if_exists(conn, "sessions", "refresh_token")
    drop_not_null_if_exists(conn, "sessions", "expires_at")
    create_unique_index_if_missing(
        conn,
        "sessions",
        "sessions_token_unique_idx",
        "token",
        "WHERE token IS NOT NULL",
    )
    conn.commit()
