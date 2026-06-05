"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { request } from "../lib/api";

export default function ResetPasswordForm({ token = "" }) {
  const router = useRouter();
  const [form, setForm] = useState({
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");

    if (!token) {
      setError("Khong tim thay ma dat lai. Hay yeu cau email moi.");
      setLoading(false);
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Mat khau xac nhan khong khop.");
      setLoading(false);
      return;
    }

    try {
      const data = await request("/auth/reset-password", {
        method: "POST",
        body: {
          token,
          password: form.password,
          confirm_password: form.confirmPassword,
        },
      });
      setInfo(data.message || "Mat khau da duoc dat lai.");
      router.push("/login?reset=success");
    } catch (err) {
      setError(err.message || "Khong the dat lai mat khau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <span className="badge">KidLearn</span>
        <h1>Dat lai mat khau</h1>
        <p>Lien ket nay chi co hieu luc trong thoi gian ngan.</p>

        {!token ? (
          <div className="info">
            Khong tim thay ma dat lai. Hay{" "}
            <Link href="/forgot-password">yeu cau lai lien ket</Link>.
          </div>
        ) : null}

        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="field">
            <span>Mat khau moi</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm((current) => ({ ...current, password: event.target.value }))
              }
              placeholder="It nhat 8 ky tu"
              required
            />
          </label>

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

          <button className="btn primary submit" type="submit" disabled={loading || !token}>
            {loading ? "Dang dat lai..." : "Dat lai mat khau"}
          </button>
        </form>

        {info ? <div className="info">{info}</div> : null}
        {error ? <div className="error">{error}</div> : null}

        <div className="auth-links">
          <Link className="btn secondary" href="/login">
            Quay lai dang nhap
          </Link>
          <Link className="btn secondary" href="/forgot-password">
            Gui lai lien ket
          </Link>
        </div>
      </section>
    </main>
  );
}
