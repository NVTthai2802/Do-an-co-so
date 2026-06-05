"use client";

import Link from "next/link";
import { useState } from "react";
import { request } from "../lib/api";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [resetUrl, setResetUrl] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");
    setResetUrl("");

    try {
      const data = await request("/auth/forgot-password", {
        method: "POST",
        body: { email },
      });
      setInfo(data.message || "Neu email ton tai, chung toi da gui lien ket dat lai mat khau.");
      setResetUrl(data.development_reset_url || "");
    } catch (err) {
      setError(err.message || "Khong the gui lien ket dat lai mat khau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <span className="badge">KidLearn</span>
        <h1>Quen mat khau</h1>
        <p>Nhap email de nhan lien ket dat lai mat khau qua email.</p>

        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="bean@example.com"
              required
            />
          </label>

          <button className="btn primary submit" type="submit" disabled={loading}>
            {loading ? "Dang gui..." : "Gui lien ket dat lai"}
          </button>
        </form>

        {info ? <div className="info">{info}</div> : null}
        {resetUrl ? (
          <div className="info">
            <a className="text-link" href={resetUrl}>
              Mo lien ket dat lai mat khau
            </a>
          </div>
        ) : null}
        {error ? <div className="error">{error}</div> : null}

        <div className="auth-links">
          <Link className="btn secondary" href="/login">
            Quay lai dang nhap
          </Link>
          <Link className="btn secondary" href="/register">
            Dang ky tai khoan
          </Link>
        </div>
      </section>
    </main>
  );
}
