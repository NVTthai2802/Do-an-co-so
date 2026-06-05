"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { request } from "../lib/api";
import {
  clearVerificationSession,
  getVerificationSession,
  saveSession,
  saveVerificationSession,
} from "../lib/auth";

function formatSeconds(totalSeconds) {
  const safeTotal = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeTotal / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (safeTotal % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function VerifyOtpForm({ initialVerification = null }) {
  const router = useRouter();
  const [verification, setVerification] = useState(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);
  const [otpCountdown, setOtpCountdown] = useState(0);

  useEffect(() => {
    const stored = getVerificationSession();

    if (initialVerification?.token) {
      const token = initialVerification.token;
      const email = initialVerification.email || "";
      const resendAfterSeconds = initialVerification.resendAfterSeconds || 60;
      const otpExpiresInSeconds = initialVerification.otpExpiresInSeconds || 600;
      const verificationCode = initialVerification.code || (stored && stored.token === token ? stored.code || "" : "");
      const nextVerification =
        stored && stored.token === token
          ? { ...stored, code: verificationCode || stored.code || "" }
          : {
              token,
              email,
              code: verificationCode,
              resendAvailableAt: Date.now() + resendAfterSeconds * 1000,
              otpExpiresAt: Date.now() + otpExpiresInSeconds * 1000,
            };

      if (!stored || stored.token !== token || (verificationCode && stored.code !== verificationCode)) {
        saveVerificationSession({
          token,
          email,
          resendAfterSeconds,
          otpExpiresInSeconds,
          code: verificationCode,
        });
      }

      setVerification(nextVerification);
      return;
    }

    if (stored) {
      setVerification(stored);
      return;
    }

    setVerification(null);
  }, [initialVerification]);

  useEffect(() => {
    if (verification?.code) {
      setCode((current) => current || verification.code);
    }
  }, [verification]);

  useEffect(() => {
    if (!verification) {
      return undefined;
    }

    const updateCountdowns = () => {
      setResendCountdown(
        Math.max(0, Math.ceil((verification.resendAvailableAt - Date.now()) / 1000))
      );
      setOtpCountdown(
        Math.max(0, Math.ceil((verification.otpExpiresAt - Date.now()) / 1000))
      );
    };

    updateCountdowns();
    const timer = window.setInterval(updateCountdowns, 1000);
    return () => window.clearInterval(timer);
  }, [verification]);

  async function handleVerify(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");

    if (!verification?.token) {
      setError("Khong tim thay ma xac minh. Hay dang ky hoac dang nhap lai.");
      setLoading(false);
      return;
    }

    try {
      const data = await request("/auth/verify-otp", {
        method: "POST",
        body: {
          code,
          verification_token: verification.token,
        },
      });
      clearVerificationSession();
      saveSession(data.access_token, data.user);
      router.push("/dashboard");
    } catch (err) {
      setError(err.message || "Khong the xac minh OTP.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setLoading(true);
    setError("");
    setInfo("");

    if (!verification?.token) {
      setError("Khong tim thay ma xac minh. Hay dang ky hoac dang nhap lai.");
      setLoading(false);
      return;
    }

    try {
      const data = await request("/auth/resend-otp", {
        method: "POST",
        body: {
          verification_token: verification.token,
        },
      });
      const resendAfterSeconds = data.resend_after_seconds || 60;
      const otpExpiresInSeconds = data.otp_expires_in_seconds || 600;
      const developmentCode = data.development_otp || "";
      const nextVerification = {
        ...verification,
        resendAvailableAt: Date.now() + resendAfterSeconds * 1000,
        otpExpiresAt: Date.now() + otpExpiresInSeconds * 1000,
        code: developmentCode || verification.code || "",
      };
      saveVerificationSession({
        token: verification.token,
        email: verification.email,
        resendAfterSeconds,
        otpExpiresInSeconds,
        code: developmentCode || verification.code || "",
      });
      setVerification(nextVerification);
      setCode(developmentCode);
      setInfo(data.message || "Da gui lai ma OTP vao email.");
    } catch (err) {
      setError(err.message || "Khong the gui lai OTP.");
    } finally {
      setLoading(false);
    }
  }

  const canResend = Boolean(verification) && resendCountdown === 0 && !loading;
  const emailLabel = verification?.email || "Email cua ban";

  return (
    <main className="auth-shell">
      <section className="auth-card auth-card-wide">
        <span className="badge">KidLearn</span>
        <h1>Xac minh OTP</h1>
        <p>Nhap ma da gui toi email de kich hoat tai khoan.</p>

        {verification ? (
          <div className="status-stack">
            <div className="status-chip">
              <span>Email</span>
              <strong>{emailLabel}</strong>
            </div>
            <div className="status-grid">
              <div className="status-chip muted">
                <span>OTP het han sau</span>
                <strong>{formatSeconds(otpCountdown)}</strong>
              </div>
              <div className="status-chip muted">
                <span>Gui lai sau</span>
                <strong>{formatSeconds(resendCountdown)}</strong>
              </div>
            </div>
          </div>
        ) : (
          <div className="info">
            Khong tim thay phien xac minh. Hay dang ky hoac dang nhap lai de lay ma moi.
          </div>
        )}

        <form className="form-grid" onSubmit={handleVerify}>
          <label className="field">
            <span>Ma OTP</span>
            <input
              inputMode="numeric"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="6 chu so"
              required
            />
          </label>
          {verification?.code ? (
            <div className="info">Che do local: OTP da duoc dien san trong ung dung.</div>
          ) : null}

          <button className="btn primary submit" type="submit" disabled={loading || !verification}>
            {loading ? "Dang xu ly..." : "Xac minh OTP"}
          </button>

          <button
            className="btn secondary submit"
            type="button"
            disabled={!canResend}
            onClick={handleResend}
          >
            {resendCountdown > 0 ? `Gui lai OTP sau ${formatSeconds(resendCountdown)}` : "Gui lai OTP"}
          </button>
        </form>

        {info ? <div className="info">{info}</div> : null}
        {error ? <div className="error">{error}</div> : null}

        <div className="auth-links">
          <Link className="btn secondary" href="/login">
            Quay lai dang nhap
          </Link>
          <Link className="btn secondary" href="/register">
            Dang ky tai khoan moi
          </Link>
        </div>
      </section>
    </main>
  );
}
