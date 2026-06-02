"""
crud.py
Các hàm thao tác database (Create / Read / Update / Delete).
"""

from sqlalchemy.orm import Session
from passlib.context import CryptContext
from datetime import datetime, timezone

from .models import User, Child, Lesson, Progress, Score, LessonType
from .schemas import UserRegister, ChildCreate, ScoreCreate

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ─── USER ───────────────────────────────────────

def get_user_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).first()


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def create_user(db: Session, data: UserRegister) -> User:
    user = User(
        username=data.username,
        email=data.email,
        hashed_password=pwd_ctx.hash(data.password),
        full_name=data.full_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)


# ─── CHILD ──────────────────────────────────────

def get_children(db: Session, parent_id: int) -> list[Child]:
    return db.query(Child).filter(Child.parent_id == parent_id).all()


def create_child(db: Session, parent_id: int, data: ChildCreate) -> Child:
    child = Child(parent_id=parent_id, **data.model_dump())
    db.add(child)
    db.commit()
    db.refresh(child)
    return child


# ─── LESSON ─────────────────────────────────────

def get_lessons(db: Session, lesson_type: LessonType | None = None) -> list[Lesson]:
    q = db.query(Lesson).filter(Lesson.is_active == True)
    if lesson_type:
        q = q.filter(Lesson.type == lesson_type)
    return q.order_by(Lesson.order_index).all()


def get_lesson(db: Session, lesson_id: int) -> Lesson | None:
    return db.query(Lesson).filter(Lesson.id == lesson_id).first()


# ─── PROGRESS ───────────────────────────────────

def get_or_create_progress(db: Session, child_id: int, lesson_id: int) -> Progress:
    prog = (
        db.query(Progress)
        .filter(Progress.child_id == child_id, Progress.lesson_id == lesson_id)
        .first()
    )
    if not prog:
        prog = Progress(child_id=child_id, lesson_id=lesson_id)
        db.add(prog)
        db.commit()
        db.refresh(prog)
    return prog


def mark_lesson_complete(db: Session, child_id: int, lesson_id: int) -> Progress:
    prog = get_or_create_progress(db, child_id, lesson_id)
    prog.is_completed = True
    prog.attempts += 1
    prog.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(prog)
    return prog


def get_child_progress(db: Session, child_id: int) -> list[Progress]:
    return db.query(Progress).filter(Progress.child_id == child_id).all()


# ─── SCORE ──────────────────────────────────────

def add_score(db: Session, child_id: int, data: ScoreCreate) -> Score:
    score = Score(child_id=child_id, **data.model_dump())
    db.add(score)
    # Cập nhật progress
    prog = get_or_create_progress(db, child_id, data.lesson_id)
    prog.attempts += 1
    if data.score >= 80 and not prog.is_completed:
        prog.is_completed = True
        prog.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(score)
    return score


def get_child_scores(db: Session, child_id: int, lesson_id: int | None = None) -> list[Score]:
    q = db.query(Score).filter(Score.child_id == child_id)
    if lesson_id:
        q = q.filter(Score.lesson_id == lesson_id)
    return q.order_by(Score.created_at.desc()).all()
