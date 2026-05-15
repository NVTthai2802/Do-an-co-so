"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { request } from "../lib/api";
import { saveSession } from "../lib/auth";

export default function AuthForm({ mode }) {
  const router = useRouter();
  const isRegister = mode === "register";
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const title = isRegister ? "Đăng ký tài khoản" : "Đăng nhập";
  const subtitle = isRegister
    ? "Tạo tài khoản để bé bắt đầu học số, chữ và hình."
    : "Chào mừng bạn quay lại với KidLearn.";

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload = isRegister
        ? form
        : {
            email: form.email,
            password: form.password,
          };

      const data = await request(
        isRegister ? "/auth/register" : "/auth/login",
        {
          method: "POST",
          body: payload,
        }
      );

      saveSession(data.access_token, data.user);
      router.push("/dashboard");
    } catch (err) {
      setError(err.message || "Không thể xử lý yêu cầu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <span className="badge">KidLearn</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>

        <form className="form-grid" onSubmit={handleSubmit}>
          {isRegister ? (
            <label className="field">
              <span>Họ và tên</span>
              <input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Ví dụ: Bé An"
                required
              />
            </label>
          ) : null}

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
              placeholder="bean@example.com"
              required
            />
          </label>

          <label className="field">
            <span>Mật khẩu</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              placeholder="Ít nhất 6 ký tự"
              required
            />
          </label>

          <button className="btn primary submit" type="submit" disabled={loading}>
            {loading ? "Đang xử lý..." : isRegister ? "Tạo tài khoản" : "Đăng nhập"}
          </button>
        </form>

        {error ? <div className="error">{error}</div> : null}

        <div className="auth-links">
          <Link className="btn secondary" href={isRegister ? "/login" : "/register"}>
            {isRegister ? "Đã có tài khoản? Đăng nhập" : "Chưa có tài khoản? Đăng ký"}
          </Link>
          <Link className="btn secondary" href="/">
            Về trang chủ
          </Link>
        </div>
      </section>
    </main>
  );
}

