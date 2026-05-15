# KidLearn

Web học tập cho bé với:
- Đăng ký / đăng nhập
- Trang chủ học số, học chữ, nhận dạng hình
- FastAPI + SQLite cho backend
- Next.js + HTML/CSS/JS cho frontend

## Chạy backend

```bash
cd backend
pip install -r requirements.txt
copy .env.example .env
python main.py
```

> Nếu cổng 8000 đang bận, backend sẽ tự chuyển sang cổng trống kế tiếp.

## Chạy frontend

```bash
cd frontend
npm install
copy .env.example .env.local
npm run dev
```

