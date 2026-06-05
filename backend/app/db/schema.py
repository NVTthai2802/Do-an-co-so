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
        conn.execute(f"ALTER TABLE {table_name} ALTER COLUMN {column_name} DROP NOT NULL")


def drop_column_if_exists(conn, table_name: str, column_name: str):
    if column_name in get_table_columns(conn, table_name):
        conn.execute(f"ALTER TABLE {table_name} DROP COLUMN {column_name}")


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


def create_index_if_missing(conn, table_name: str, index_name: str, columns_sql: str):
    conn.execute(
        f"CREATE INDEX IF NOT EXISTS {index_name} ON {table_name} {columns_sql}"
    )


def initialize_schema(conn):
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id BIGSERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT")
    conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT")
    conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT")
    conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE")
    conn.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
    )

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
        conn.execute(
            """
            UPDATE users
            SET password_hash = hashed_password
            WHERE password_hash IS NULL AND hashed_password IS NOT NULL
            """
        )

    for column_name in (
        "is_verified",
        "verification_token_hash",
        "verification_token_expires_at",
        "verification_code_hash",
        "verification_code_expires_at",
        "verification_code_sent_at",
        "verification_attempts",
        "verification_locked_until",
    ):
        drop_column_if_exists(conn, "users", column_name)

    create_unique_index_if_missing(conn, "users", "users_email_unique_idx", "email")

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    conn.execute("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS token TEXT")
    conn.execute("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id BIGINT")
    conn.execute(
        "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
    )
    drop_not_null_if_exists(conn, "sessions", "refresh_token")
    drop_not_null_if_exists(conn, "sessions", "expires_at")
    create_unique_index_if_missing(
        conn,
        "sessions",
        "sessions_token_unique_idx",
        "token",
        "WHERE token IS NOT NULL",
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS auth_throttles (
            scope TEXT NOT NULL,
            identifier TEXT NOT NULL,
            failure_count INTEGER NOT NULL DEFAULT 0,
            locked_until TIMESTAMPTZ,
            last_failure_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (scope, identifier)
        )
        """
    )
    conn.execute("ALTER TABLE auth_throttles ADD COLUMN IF NOT EXISTS scope TEXT")
    conn.execute("ALTER TABLE auth_throttles ADD COLUMN IF NOT EXISTS identifier TEXT")
    conn.execute("ALTER TABLE auth_throttles ADD COLUMN IF NOT EXISTS failure_count INTEGER NOT NULL DEFAULT 0")
    conn.execute("ALTER TABLE auth_throttles ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ")
    conn.execute("ALTER TABLE auth_throttles ADD COLUMN IF NOT EXISTS last_failure_at TIMESTAMPTZ")
    conn.execute("ALTER TABLE auth_throttles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()")
    conn.execute("ALTER TABLE auth_throttles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()")
    conn.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS auth_throttles_scope_identifier_unique_idx
        ON auth_throttles (scope, identifier)
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            token_hash TEXT PRIMARY KEY,
            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            expires_at TIMESTAMPTZ NOT NULL,
            used_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    conn.execute("ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS token_hash TEXT")
    conn.execute("ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS user_id BIGINT")
    conn.execute(
        "ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
    )
    conn.execute("ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ")
    conn.execute(
        "ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
    )
    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx
        ON password_reset_tokens (user_id)
        """
    )
    conn.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS password_reset_tokens_one_active_idx
        ON password_reset_tokens (user_id)
        WHERE used_at IS NULL
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS learning_results (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            module_key TEXT NOT NULL,
            activity_key TEXT NOT NULL,
            title TEXT NOT NULL,
            score DOUBLE PRECISION NOT NULL DEFAULT 0,
            max_score DOUBLE PRECISION NOT NULL DEFAULT 100,
            accuracy DOUBLE PRECISION,
            time_spent_seconds INTEGER NOT NULL DEFAULT 0,
            detail_json TEXT NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    conn.execute("ALTER TABLE learning_results ADD COLUMN IF NOT EXISTS user_id BIGINT")
    conn.execute("ALTER TABLE learning_results ADD COLUMN IF NOT EXISTS module_key TEXT")
    conn.execute("ALTER TABLE learning_results ADD COLUMN IF NOT EXISTS activity_key TEXT")
    conn.execute("ALTER TABLE learning_results ADD COLUMN IF NOT EXISTS title TEXT")
    conn.execute("ALTER TABLE learning_results ADD COLUMN IF NOT EXISTS score DOUBLE PRECISION NOT NULL DEFAULT 0")
    conn.execute("ALTER TABLE learning_results ADD COLUMN IF NOT EXISTS max_score DOUBLE PRECISION NOT NULL DEFAULT 100")
    conn.execute("ALTER TABLE learning_results ADD COLUMN IF NOT EXISTS accuracy DOUBLE PRECISION")
    conn.execute("ALTER TABLE learning_results ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER NOT NULL DEFAULT 0")
    conn.execute("ALTER TABLE learning_results ADD COLUMN IF NOT EXISTS detail_json TEXT NOT NULL DEFAULT '{}'")
    conn.execute("ALTER TABLE learning_results ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()")
    create_index_if_missing(conn, "learning_results", "learning_results_user_id_idx", "(user_id)")
    create_index_if_missing(conn, "learning_results", "learning_results_module_key_idx", "(module_key)")
    create_index_if_missing(conn, "learning_results", "learning_results_created_at_idx", "(created_at DESC)")

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS document_summaries (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            source_name TEXT,
            source_type TEXT NOT NULL,
            original_text TEXT NOT NULL,
            summary_text TEXT NOT NULL,
            sentence_count INTEGER NOT NULL DEFAULT 0,
            original_length INTEGER NOT NULL DEFAULT 0,
            summary_length INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    conn.execute("ALTER TABLE document_summaries ADD COLUMN IF NOT EXISTS user_id BIGINT")
    conn.execute("ALTER TABLE document_summaries ADD COLUMN IF NOT EXISTS source_name TEXT")
    conn.execute("ALTER TABLE document_summaries ADD COLUMN IF NOT EXISTS source_type TEXT")
    conn.execute("ALTER TABLE document_summaries ADD COLUMN IF NOT EXISTS original_text TEXT")
    conn.execute("ALTER TABLE document_summaries ADD COLUMN IF NOT EXISTS summary_text TEXT")
    conn.execute("ALTER TABLE document_summaries ADD COLUMN IF NOT EXISTS sentence_count INTEGER NOT NULL DEFAULT 0")
    conn.execute("ALTER TABLE document_summaries ADD COLUMN IF NOT EXISTS original_length INTEGER NOT NULL DEFAULT 0")
    conn.execute("ALTER TABLE document_summaries ADD COLUMN IF NOT EXISTS summary_length INTEGER NOT NULL DEFAULT 0")
    conn.execute("ALTER TABLE document_summaries ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()")
    create_index_if_missing(conn, "document_summaries", "document_summaries_user_id_idx", "(user_id)")
    create_index_if_missing(
        conn,
        "document_summaries",
        "document_summaries_created_at_idx",
        "(created_at DESC)",
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS skill_statistics (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            alphabet_score DOUBLE PRECISION NOT NULL DEFAULT 0,
            number_score DOUBLE PRECISION NOT NULL DEFAULT 0,
            geometry_score DOUBLE PRECISION NOT NULL DEFAULT 0,
            math_score DOUBLE PRECISION NOT NULL DEFAULT 0,
            reading_score DOUBLE PRECISION NOT NULL DEFAULT 0,
            time_score DOUBLE PRECISION NOT NULL DEFAULT 0,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    conn.execute("ALTER TABLE skill_statistics ADD COLUMN IF NOT EXISTS user_id BIGINT")
    conn.execute("ALTER TABLE skill_statistics ADD COLUMN IF NOT EXISTS alphabet_score DOUBLE PRECISION NOT NULL DEFAULT 0")
    conn.execute("ALTER TABLE skill_statistics ADD COLUMN IF NOT EXISTS number_score DOUBLE PRECISION NOT NULL DEFAULT 0")
    conn.execute("ALTER TABLE skill_statistics ADD COLUMN IF NOT EXISTS geometry_score DOUBLE PRECISION NOT NULL DEFAULT 0")
    conn.execute("ALTER TABLE skill_statistics ADD COLUMN IF NOT EXISTS math_score DOUBLE PRECISION NOT NULL DEFAULT 0")
    conn.execute("ALTER TABLE skill_statistics ADD COLUMN IF NOT EXISTS reading_score DOUBLE PRECISION NOT NULL DEFAULT 0")
    conn.execute("ALTER TABLE skill_statistics ADD COLUMN IF NOT EXISTS time_score DOUBLE PRECISION NOT NULL DEFAULT 0")
    conn.execute("ALTER TABLE skill_statistics ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()")
    create_unique_index_if_missing(
        conn,
        "skill_statistics",
        "skill_statistics_user_id_unique_idx",
        "user_id",
    )

    conn.commit()
