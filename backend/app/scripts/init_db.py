import psycopg

from app.core.config import get_database_url
from app.db.schema import initialize_schema


def create_tables():
    with psycopg.connect(get_database_url()) as conn:
        initialize_schema(conn)
    print("Created KidLearn Postgres tables.")


if __name__ == "__main__":
    create_tables()
