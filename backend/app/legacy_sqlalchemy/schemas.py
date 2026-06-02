"""
schemas.py
Pydantic schemas dùng cho FastAPI request / response.
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from .models import LessonType, DifficultyLevel


# ─── USER ───────────────────────────────────────

class UserRegister(BaseModel):
    username:  str       = Field(..., min_length=3, max_length=50)
    email:     EmailStr
    password:  str       = Field(..., min_length=6)
    full_name: Optional[str] = None


class UserLogin(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id:        int
    username:  str
    email:     str
    full_name: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"


# ─── CHILD ──────────────────────────────────────

class ChildCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    age:  Optional[int] = Field(None, ge=2, le=12)


class ChildOut(BaseModel):
    id:         int
    name:       str
    age:        Optional[int]
    avatar_url: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── LESSON ─────────────────────────────────────

class LessonOut(BaseModel):
    id:          int
    type:        LessonType
    title:       str
    description: Optional[str]
    difficulty:  DifficultyLevel
    order_index: int
    image_url:   Optional[str]

    class Config:
        from_attributes = True


# ─── PROGRESS ───────────────────────────────────

class ProgressOut(BaseModel):
    id:           int
    lesson_id:    int
    is_completed: bool
    attempts:     int
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


# ─── SCORE ──────────────────────────────────────

class ScoreCreate(BaseModel):
    lesson_id:  int
    score:      float = Field(..., ge=0, le=100)
    time_spent: int   = Field(0, ge=0)   # Giây


class ScoreOut(BaseModel):
    id:         int
    lesson_id:  int
    score:      float
    time_spent: int
    created_at: datetime

    class Config:
        from_attributes = True
