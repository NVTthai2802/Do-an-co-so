"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { request } from "../lib/api";
import { saveSession, saveVerificationSession } from "../lib/auth";

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
    ? "Tao tai khoan voi xac minh OTP qua email."
    : "Chao mung ban quay lai voi KidLearn.";

  function goToVerify(data) {
    const developmentOtp = data.development_otp || data.code || "";
    saveVerificationSession({
      token: data.verification_token,
      email: data.email || form.email,
      resendAfterSeconds: data.resend_after_seconds || 60,
      otpExpiresInSeconds: data.otp_expires_in_seconds || 600,
      code: developmentOtp,
    });
    const params = new URLSearchParams();
    params.set("token", data.verification_token);
    params.set("email", data.email || form.email);
    if (developmentOtp) {
      params.set("code", developmentOtp);
    }
    if (data.resend_after_seconds) {
      params.set("resend_after_seconds", String(data.resend_after_seconds));
    }
    if (data.otp_expires_in_seconds) {
      params.set("otp_expires_in_seconds", String(data.otp_expires_in_seconds));
    }
    router.push(`/verify-otp?${params.toString()}`);
  }

  async function handleRegister(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Mat khau xac nhan khong khop.");
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
      goToVerify(data);
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

      if (data.requires_verification) {
        goToVerify(data);
        return;
      }

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
              required
            />
          </label>

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
