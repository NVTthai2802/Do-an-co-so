"""
init_db.py
Chạy một lần để tạo tất cả bảng và seed dữ liệu mẫu.
  python init_db.py
"""

from database import engine, SessionLocal, Base
from models import User, Child, Lesson, Progress, Score, Session
from models import LessonType, DifficultyLevel
from passlib.context import CryptContext
from datetime import datetime, timezone

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ──────────────────────────────────────────────
# 1. Tạo tất cả bảng
# ──────────────────────────────────────────────

def create_tables():
    Base.metadata.create_all(bind=engine)
    print("✅  Đã tạo tất cả bảng.")


# ──────────────────────────────────────────────
# 2. Seed dữ liệu mẫu
# ──────────────────────────────────────────────

LESSONS_SEED = [
    # --- HỌC SỐ ---
    {"type": LessonType.SO, "title": "Số 1 - 5",       "description": "Học nhận biết số từ 1 đến 5",   "difficulty": DifficultyLevel.DE,    "order_index": 1},
    {"type": LessonType.SO, "title": "Số 6 - 10",      "description": "Học nhận biết số từ 6 đến 10",  "difficulty": DifficultyLevel.DE,    "order_index": 2},
    {"type": LessonType.SO, "title": "Đếm đồ vật",     "description": "Đếm số lượng đồ vật trong hình","difficulty": DifficultyLevel.TRUNG, "order_index": 3},
    {"type": LessonType.SO, "title": "So sánh số",     "description": "So sánh hai số lớn hơn / nhỏ hơn","difficulty": DifficultyLevel.KHO,  "order_index": 4},

    # --- HỌC CHỮ ---
    {"type": LessonType.CHU, "title": "Nguyên âm A E I O U", "description": "Học các nguyên âm cơ bản","difficulty": DifficultyLevel.DE,    "order_index": 1},
    {"type": LessonType.CHU, "title": "Phụ âm B C D Đ",      "description": "Học các phụ âm đầu tiên", "difficulty": DifficultyLevel.DE,    "order_index": 2},
    {"type": LessonType.CHU, "title": "Ghép vần đơn giản",   "description": "Ghép âm tạo thành vần",   "difficulty": DifficultyLevel.TRUNG, "order_index": 3},
    {"type": LessonType.CHU, "title": "Đọc từ 2 âm tiết",    "description": "Đọc và nhận dạng từ",      "difficulty": DifficultyLevel.KHO,   "order_index": 4},

    # --- NHẬN DẠNG HÌNH ---
    {"type": LessonType.HINH, "title": "Hình tròn & Hình vuông", "description": "Nhận biết 2 hình cơ bản","difficulty": DifficultyLevel.DE,    "order_index": 1},
    {"type": LessonType.HINH, "title": "Hình tam giác & Hình chữ nhật","description": "Nhận biết thêm 2 hình", "difficulty": DifficultyLevel.DE, "order_index": 2},
    {"type": LessonType.HINH, "title": "Phân loại hình",     "description": "Sắp xếp hình theo nhóm",   "difficulty": DifficultyLevel.TRUNG, "order_index": 3},
    {"type": LessonType.HINH, "title": "Hình trong thực tế", "description": "Tìm hình học trong cuộc sống","difficulty": DifficultyLevel.KHO,  "order_index": 4},
]


def seed_data():
    db = SessionLocal()
    try:
        # Kiểm tra đã seed chưa
        if db.query(Lesson).count() > 0:
            print("ℹ️   Dữ liệu đã tồn tại, bỏ qua seed.")
            return

        # Tạo admin
        admin = User(
            username="admin",
            email="admin@kidlearn.vn",
            hashed_password=pwd_ctx.hash("admin123"),
            full_name="Quản trị viên",
            is_admin=True,
        )
        db.add(admin)
        db.flush()  # Lấy admin.id

        # Tạo user mẫu
        demo_user = User(
            username="nguyen_van_a",
            email="demo@kidlearn.vn",
            hashed_password=pwd_ctx.hash("demo123"),
            full_name="Nguyễn Văn A",
        )
        db.add(demo_user)
        db.flush()

        # Tạo bé mẫu
        child = Child(
            parent_id=demo_user.id,
            name="Bé Bông",
            age=5,
        )
        db.add(child)

        # Tạo bài học
        lessons = [Lesson(**l) for l in LESSONS_SEED]
        db.add_all(lessons)

        db.commit()
        print(f"✅  Seed xong: {len(lessons)} bài học, 1 admin, 1 user mẫu.")
    except Exception as e:
        db.rollback()
        print(f"❌  Lỗi khi seed: {e}")
        raise
    finally:
        db.close()


# ──────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────

if __name__ == "__main__":
    print("🚀  Khởi tạo database KidLearn...")
    create_tables()
    seed_data()
    print("🎉  Hoàn tất!")
