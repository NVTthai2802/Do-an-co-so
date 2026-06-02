from sqlalchemy import (
    Column, Integer, String, Boolean, Float,
    DateTime, ForeignKey, Enum, Text
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from .database import Base


# ──────────────────────────────────────────────
# ENUM
# ──────────────────────────────────────────────

class LessonType(str, enum.Enum):
    SO   = "so"     # Học số
    CHU  = "chu"    # Học chữ
    HINH = "hinh"   # Nhận dạng hình


class DifficultyLevel(str, enum.Enum):
    DE    = "de"
    TRUNG = "trung"
    KHO   = "kho"


# ──────────────────────────────────────────────
# BẢNG: users  (đăng ký / đăng nhập)
# ──────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    username      = Column(String(50),  unique=True, nullable=False, index=True)
    email         = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name     = Column(String(100), nullable=True)
    avatar_url    = Column(String(255), nullable=True)
    is_active     = Column(Boolean, default=True)
    is_admin      = Column(Boolean, default=False)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), onupdate=func.now())

    # Quan hệ
    children      = relationship("Child",    back_populates="parent", cascade="all, delete-orphan")
    sessions      = relationship("Session",  back_populates="user",   cascade="all, delete-orphan")


# ──────────────────────────────────────────────
# BẢNG: children  (hồ sơ từng bé)
# ──────────────────────────────────────────────

class Child(Base):
    __tablename__ = "children"

    id         = Column(Integer, primary_key=True, index=True)
    parent_id  = Column(Integer, ForeignKey("users.id"), nullable=False)
    name       = Column(String(100), nullable=False)
    age        = Column(Integer, nullable=True)
    avatar_url = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Quan hệ
    parent   = relationship("User",     back_populates="children")
    progress = relationship("Progress", back_populates="child", cascade="all, delete-orphan")
    scores   = relationship("Score",    back_populates="child", cascade="all, delete-orphan")


# ──────────────────────────────────────────────
# BẢNG: lessons  (nội dung bài học)
# ──────────────────────────────────────────────

class Lesson(Base):
    __tablename__ = "lessons"

    id          = Column(Integer, primary_key=True, index=True)
    type        = Column(Enum(LessonType), nullable=False, index=True)
    title       = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    content     = Column(Text, nullable=True)   # JSON string chứa nội dung bài
    difficulty  = Column(Enum(DifficultyLevel), default=DifficultyLevel.DE)
    order_index = Column(Integer, default=0)    # Thứ tự hiển thị
    image_url   = Column(String(255), nullable=True)
    audio_url   = Column(String(255), nullable=True)
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    # Quan hệ
    progress = relationship("Progress", back_populates="lesson")
    scores   = relationship("Score",    back_populates="lesson")


# ──────────────────────────────────────────────
# BẢNG: progress  (tiến trình học của từng bé)
# ──────────────────────────────────────────────

class Progress(Base):
    __tablename__ = "progress"

    id           = Column(Integer, primary_key=True, index=True)
    child_id     = Column(Integer, ForeignKey("children.id"), nullable=False)
    lesson_id    = Column(Integer, ForeignKey("lessons.id"),  nullable=False)
    is_completed = Column(Boolean, default=False)
    attempts     = Column(Integer, default=0)   # Số lần thử
    last_seen_at = Column(DateTime(timezone=True), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Quan hệ
    child  = relationship("Child",  back_populates="progress")
    lesson = relationship("Lesson", back_populates="progress")


# ──────────────────────────────────────────────
# BẢNG: scores  (điểm số mỗi lần làm bài)
# ──────────────────────────────────────────────

class Score(Base):
    __tablename__ = "scores"

    id          = Column(Integer, primary_key=True, index=True)
    child_id    = Column(Integer, ForeignKey("children.id"), nullable=False)
    lesson_id   = Column(Integer, ForeignKey("lessons.id"),  nullable=False)
    score       = Column(Float,   default=0.0)      # 0 – 100
    max_score   = Column(Float,   default=100.0)
    time_spent  = Column(Integer, default=0)        # Giây
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    # Quan hệ
    child  = relationship("Child",  back_populates="scores")
    lesson = relationship("Lesson", back_populates="scores")


# ──────────────────────────────────────────────
# BẢNG: sessions  (JWT / refresh token)
# ──────────────────────────────────────────────

class Session(Base):
    __tablename__ = "sessions"

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=False)
    refresh_token = Column(String(512), unique=True, nullable=False, index=True)
    expires_at    = Column(DateTime(timezone=True), nullable=False)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    is_revoked    = Column(Boolean, default=False)

    # Quan hệ
    user = relationship("User", back_populates="sessions")
