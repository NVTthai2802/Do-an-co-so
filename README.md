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
- Backend chạy model `best.onnx` bằng ONNX Runtime, nhẹ hơn so với `ultralytics`/`torch`. File `best.onnx` cần nằm trong `backend/app/ml/artifacts` khi deploy.

### Lỗi Postgres 503 trên Vercel

Nếu form báo `Không kết nối được database Postgres`, kiểm tra trong Vercel Project Settings:

- Không đặt `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kidlearn` cho Production/Preview. `localhost` trên Vercel là server của Vercel, không phải máy tính của bạn.
- Nên dùng `POSTGRES_URL` từ Vercel Storage/Postgres, hoặc `DATABASE_URL` từ Neon/Supabase/cloud Postgres.
- URL cloud nên có SSL, ví dụ `?sslmode=require`. Với Neon, không dùng `sslmode=req`.

### Bảo mật tài khoản bằng OTP email

Luồng đăng ký hiện tại dùng OTP gửi email trước khi cho đăng nhập.

Thêm các biến môi trường sau trong Vercel Project Settings:

- `SMTP_HOST`
- `SMTP_PORT` mặc định `587`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM` nếu muốn địa chỉ gửi khác `SMTP_USER`
- `SMTP_USE_TLS` mặc định `1`

Nếu chưa cấu hình SMTP, backend vẫn tạo tài khoản nhưng không gửi được OTP. Muốn bật bảo mật đầy đủ, phải cấu hình SMTP hợp lệ.
- Sau khi sửa Environment Variables, bấm Redeploy để backend nhận cấu hình mới.

## Tính năng AI nhận diện số

Backend có API `POST /api/recognize-number` để nhận ảnh Base64 từ camera và chạy model `best.onnx`.

Thiết lập local:

```powershell
cd backend
py -m pip install -r requirements.txt
mkdir app\ml\artifacts
copy C:\duong-dan\best.onnx app\ml\artifacts\best.onnx
py main.py
```

Nếu chưa có `backend/app/ml/artifacts/best.onnx` hoặc chưa cài dependency trong `requirements.txt`, app vẫn chạy; phần camera sẽ báo model chưa sẵn sàng.

## Auth hardening

- Registration now requires `confirm_password`.
- Login is rate-limited by email and IP with temporary lockouts after repeated failures.
- OTP resend has a cooldown so one account cannot spam mail.
- For email delivery on Vercel, prefer `EMAIL_PROVIDER=resend` with:
  - `RESEND_API_KEY`
  - `RESEND_FROM`
- SMTP still works with:
  - `SMTP_HOST`
  - `SMTP_PORT`
  - `SMTP_USER`
  - `SMTP_PASSWORD`
  - `SMTP_FROM`
  - `SMTP_USE_TLS`

### Auth routes

- `/verify-otp` is the dedicated OTP screen.
- `/forgot-password` sends a reset link by email.
- `/reset-password` accepts the one-time reset token from the email.
- Set `APP_URL` or `FRONTEND_URL` in Vercel so backend email links point to the deployed site.
