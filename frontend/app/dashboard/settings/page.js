"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clearSession, getToken, saveSession } from "../../../lib/auth";
import { request } from "../../../lib/api";
import { effectsEnabled, setEffectsEnabled } from "../../../lib/celebrate";
import { setSoundEnabled, soundEnabled } from "../../../lib/sfx";
import { QUESTIONS_PER_ROUND } from "../../../hooks/useQuizSession";
import ParentNav from "../../../components/ParentNav";

/**
 * Cài đặt cho phụ huynh (Mục 5.9, mục 4).
 *
 * Âm thanh và hiệu ứng là hai công tắc tách rời, đúng quy tắc an toàn ở
 * Mục 6.1: tắt hiệu ứng thì không bắn pháo nhưng vẫn có âm thanh.
 */
export default function ParentSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sound, setSound] = useState(true);
  const [effects, setEffects] = useState(true);
  const token = useMemo(() => getToken(), []);

  useEffect(() => {
    if (!token) {
      router.replace("/login");
      return;
    }

    setSound(soundEnabled());
    setEffects(effectsEnabled());

    request("/auth/me", { token })
      .then((data) => saveSession(token, data.user))
      .catch(() => {
        clearSession();
        router.replace("/login");
      })
      .finally(() => setLoading(false));
  }, [router, token]);

  if (loading) {
    return (
      <main className="dashboard-shell">
        <section className="dashboard-card">Đang mở cài đặt...</section>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <section className="dashboard-card">
        <div className="dashboard-header">
          <div>
            <span className="badge">Khu vực quản lý</span>
            <h1>Cài đặt</h1>
            <p>Điều chỉnh âm thanh và hiệu ứng trong màn học của bé.</p>
          </div>
          <div className="dashboard-actions">
            <ParentNav />
            <Link href="/dashboard" className="btn secondary">
              Về trang quản lý
            </Link>
          </div>
        </div>

        <div className="section-list">
          <article className="section-card">
            <h2>Âm thanh và hiệu ứng</h2>

            <div className="setting-row">
              <div>
                <strong>Âm thanh</strong>
                <p className="field-hint">
                  Tiếng &ldquo;ting&rdquo; khi bé trả lời đúng và lời khen đọc thành tiếng.
                </p>
              </div>
              <button
                type="button"
                className="kid-switch"
                aria-pressed={sound}
                onClick={() => {
                  const next = !sound;
                  setSound(next);
                  setSoundEnabled(next);
                }}
              >
                <span aria-hidden="true">{sound ? "🔊" : "🔇"}</span>
                {sound ? "Đang bật" : "Đang tắt"}
              </button>
            </div>

            <div className="setting-row">
              <div>
                <strong>Hiệu ứng chúc mừng</strong>
                <p className="field-hint">
                  Pháo giấy và ngôi sao bay. Tắt hiệu ứng vẫn giữ nguyên âm thanh.
                  Nếu máy đang bật &ldquo;giảm chuyển động&rdquo; thì pháo luôn tắt.
                </p>
              </div>
              <button
                type="button"
                className="kid-switch"
                aria-pressed={effects}
                onClick={() => {
                  const next = !effects;
                  setEffects(next);
                  setEffectsEnabled(next);
                }}
              >
                <span aria-hidden="true">{effects ? "🎉" : "🚫"}</span>
                {effects ? "Đang bật" : "Đang tắt"}
              </button>
            </div>
          </article>

          <article className="section-card">
            <h2>Lượt chơi</h2>
            <div className="setting-row">
              <div>
                <strong>Số câu mỗi lượt</strong>
                <p className="field-hint">
                  Cố định {QUESTIONS_PER_ROUND} câu cho mỗi lượt chơi, đủ ngắn để bé
                  giữ được tập trung.
                </p>
              </div>
              <span className="setting-fixed">{QUESTIONS_PER_ROUND} câu</span>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
