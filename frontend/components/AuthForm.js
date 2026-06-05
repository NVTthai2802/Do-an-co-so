"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { request } from "../lib/api";
import { saveSession } from "../lib/auth";

function validatePasswordStrength(password) {
  if (password.length < 10) {
    return "Mat khau phai co it nhat 10 ky tu.";
  }
  if (!/[a-z]/.test(password)) {
    return "Mat khau phai co chu thuong.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Mat khau phai co chu hoa.";
  }
  if (!/\d/.test(password)) {
    return "Mat khau phai co so.";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Mat khau phai co ky tu dac biet.";
  }
  if (/\s/.test(password)) {
    return "Mat khau khong duoc chua khoang trang.";
  }

  return "";
}

export default function AuthForm({ mode, resetSuccess = false }) {
  const router = useRouter();
  const isRegister = mode === "register";
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const title = isRegister ? "Dang ky tai khoan" : "Dang nhap";
  const subtitle = isRegister
    ? "Tao tai khoan voi mat khau manh hon."
    : "Chao mung ban quay lai voi KidLearn.";

  async function handleRegister(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Mat khau xac nhan khong khop.");
      setLoading(false);
      return;
    }

    const passwordError = validatePasswordStrength(form.password);
    if (passwordError) {
      setError(passwordError);
      setLoading(false);
      return;
    }

    try {
      const data = await request("/auth/register", {
        method: "POST",
        body: {
          name: form.name,
          email: form.email,
          password: form.password,
          confirm_password: form.confirmPassword,
        },
      });
      saveSession(data.access_token, data.user);
      router.push("/dashboard");
    } catch (err) {
      setError(err.message || "Khong the xu ly yeu cau.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await request("/auth/login", {
        method: "POST",
        body: {
          email: form.email,
          password: form.password,
        },
      });

      saveSession(data.access_token, data.user);
      router.push("/dashboard");
    } catch (err) {
      setError(err.message || "Khong the xu ly yeu cau.");
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

        {resetSuccess ? <div className="info">Mat khau da duoc dat lai. Hay dang nhap lai.</div> : null}

        <form className="form-grid" onSubmit={isRegister ? handleRegister : handleLogin}>
          {isRegister ? (
            <label className="field">
              <span>Ho va ten</span>
              <input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Vi du: Be An"
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
            <span>Mat khau</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              placeholder={isRegister ? "It nhat 8 ky tu" : "Nhap mat khau"}
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
            />
          </label>

          {isRegister ? (
            <div className="password-rules">
              <span>Mat khau can co:</span>
              <ul>
                <li>It nhat 10 ky tu</li>
                <li>Chu thuong va chu hoa</li>
                <li>So va ky tu dac biet</li>
                <li>Khong co khoang trang</li>
              </ul>
            </div>
          ) : null}

          {isRegister ? (
            <label className="field">
              <span>Xac nhan mat khau</span>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    confirmPassword: event.target.value,
                }))
                }
                placeholder="Nhap lai mat khau"
                autoComplete="new-password"
                required
              />
            </label>
          ) : null}

          {!isRegister ? (
            <div className="form-help-row">
              <Link className="text-link" href="/forgot-password">
                Quen mat khau?
              </Link>
            </div>
          ) : null}

          <button className="btn primary submit" type="submit" disabled={loading}>
            {loading ? "Dang xu ly..." : isRegister ? "Tao tai khoan" : "Dang nhap"}
          </button>
        </form>

        {error ? <div className="error">{error}</div> : null}

        <div className="auth-links">
          <Link className="btn secondary" href={isRegister ? "/login" : "/register"}>
            {isRegister ? "Da co tai khoan? Dang nhap" : "Chua co tai khoan? Dang ky"}
          </Link>
          <Link className="btn secondary" href="/">
            Ve trang chu
          </Link>
        </div>
      </section>
    </main>
  );
}
