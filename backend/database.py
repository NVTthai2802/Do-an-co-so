import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Tự động phát hiện môi trường: Nếu chạy trên Vercel thì bắt buộc lưu vào /tmp
if os.getenv("VERCEL") == "1":
    SQLITE_URL = "sqlite:////tmp/kidlearn.db"
else:
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