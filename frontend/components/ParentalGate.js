"use client";

import { useEffect, useState } from "react";
import { getToken } from "../lib/auth";
import { request } from "../lib/api";

const LOCK_SECONDS = 30;

export default function ParentalGate({ onClose, onSuccess }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const locked = lockedUntil > now;
  const remainingSeconds = Math.max(0, Math.ceil((lockedUntil - now) / 1000));

  useEffect(() => {
    if (!locked) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [locked]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (locked || submitting || !password) return;

    setSubmitting(true);
    setError("");

    try {
      await request("/auth/verify-password", {
        method: "POST",
        token: getToken(),
        body: { password },
      });
      onSuccess();
    } catch (err) {
      setPassword("");
      if (err.status === 429) {
        setAttempts(0);
        setLockedUntil(Date.now() + LOCK_SECONDS * 1000);
        setError(`Nhập sai quá nhiều lần. Vui lòng thử lại sau ${LOCK_SECONDS} giây.`);
      } else {
        setAttempts((count) => count + 1);
        setError(err.message || "Mật khẩu không đúng.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="gate-overlay" role="dialog" aria-modal="true" aria-label="Xác thực phụ huynh">
      <div className="gate-card">
        <h2>Khu vực dành cho phụ huynh</h2>
        <p>Nhập lại mật khẩu tài khoản để quay lại khu vực quản lý.</p>

        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="gate-password">Mật khẩu</label>
            <input
              id="gate-password"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              disabled={locked || submitting}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {error ? (
            <div className="error">
              {locked ? `${error} (còn ${remainingSeconds}s)` : `${error} (${attempts}/5 lần)`}
            </div>
          ) : null}

          <div className="gate-actions">
            <button type="button" className="btn secondary" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="btn primary" disabled={locked || submitting || !password}>
              {locked ? `Thử lại sau ${remainingSeconds}s` : "Xác nhận"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
