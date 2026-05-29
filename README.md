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

## Deploy lên Vercel

- Trong Vercel, project cần dùng Services để `experimentalServices` trong `vercel.json` được áp dụng.
- Không đặt `NEXT_PUBLIC_API_URL=http://localhost:8000` cho Production/Preview. Khi deploy bằng Services, frontend sẽ dùng `NEXT_PUBLIC_BACKEND_URL` do Vercel tự sinh hoặc fallback về `/_backend`.
- Vercel chỉ cho ghi file trong `/tmp`; SQLite hiện dùng `/tmp/kidlearn.db` khi chạy trên Vercel. Dữ liệu này không bền vững sau cold start/redeploy, nên tài khoản thật nên chuyển sang database bền vững như Postgres/Supabase.

