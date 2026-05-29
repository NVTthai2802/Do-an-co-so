# KidLearn

Web học tập cho bé với:
- Đăng ký / đăng nhập
- Trang chủ học số, học chữ, nhận dạng hình
- FastAPI + PostgreSQL cho backend
- Next.js + HTML/CSS/JS cho frontend

## Cài PostgreSQL trên Windows

1. Tải PostgreSQL từ trang chính thức: https://www.postgresql.org/download/windows/
2. Chạy installer, giữ port mặc định `5432`.
3. Khi installer hỏi mật khẩu cho user `postgres`, đặt `postgres` nếu muốn dùng đúng cấu hình mặc định trong project. Nếu đặt mật khẩu khác, sửa `DATABASE_URL` trong `backend/.env`.
4. Sau khi cài xong, mở PowerShell mới và kiểm tra:

```powershell
psql --version
```

Nếu PowerShell không nhận `psql`, thêm thư mục `bin` của PostgreSQL vào `PATH`, ví dụ:

```text
C:\Program Files\PostgreSQL\18\bin
```

## Tạo database local

```powershell
createdb -U postgres -h localhost kidlearn
```

Nếu lệnh trên báo database đã tồn tại thì bỏ qua. Có thể kiểm tra user đã được lưu bằng:

```powershell
psql -U postgres -h localhost -d kidlearn -c "select id, name, email, created_at from users;"
```

## Chạy backend

```powershell
cd backend
py -m pip install -r requirements.txt
copy .env.example .env
py main.py
```

Backend mặc định dùng:

```text
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kidlearn
```

Nếu bạn đặt mật khẩu PostgreSQL khác, sửa `backend/.env` cho khớp.

## Chạy frontend

```powershell
cd frontend
npm install
copy .env.example .env.local
npm run dev
```

## Deploy lên Vercel

- Dùng Postgres từ Vercel Marketplace, Neon, Supabase hoặc provider tương tự.
- Thêm biến môi trường `DATABASE_URL` hoặc `POSTGRES_URL` trong Vercel Project Settings cho Production/Preview, rồi redeploy.
- Không đặt `NEXT_PUBLIC_API_URL=http://localhost:8000` cho Production/Preview. Khi deploy bằng Services, frontend sẽ dùng `NEXT_PUBLIC_BACKEND_URL` do Vercel tự sinh hoặc fallback về `/_backend`.

### Lỗi Postgres 503 trên Vercel

Nếu form báo `Không kết nối được database Postgres`, kiểm tra trong Vercel Project Settings:

- Không đặt `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kidlearn` cho Production/Preview. `localhost` trên Vercel là server của Vercel, không phải máy tính của bạn.
- Nên dùng `POSTGRES_URL` từ Vercel Storage/Postgres, hoặc `DATABASE_URL` từ Neon/Supabase/cloud Postgres.
- URL cloud nên có SSL, ví dụ `?sslmode=require`.
- Sau khi sửa Environment Variables, bấm Redeploy để backend nhận cấu hình mới.
