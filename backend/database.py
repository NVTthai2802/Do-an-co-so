from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Đường dẫn file SQLite (đặt trong thư mục backend)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SQLITE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'kidlearn.db')}"

engine = create_engine(
    SQLITE_URL,
    connect_args={"check_same_thread": False}  # Cần thiết cho SQLite + FastAPI
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency dùng trong các route FastAPI."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
