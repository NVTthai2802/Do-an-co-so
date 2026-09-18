"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clearSession, getToken, saveSession } from "../../lib/auth";
import { request } from "../../lib/api";
import ParentNav from "../../components/ParentNav";

// Mục 5.10: tên hiển thị tiếng Việt cho từng module.
const MODULE_NAMES = {
  math: "Phép toán",
  letters: "Chữ cái",
  alphabet: "Chữ cái",
  geometry: "Hình học",
  shapes: "Hình học",
  time: "Học giờ",
  reading: "Luyện đọc",
  documents: "Tài liệu",
};

// Gợi ý hành động dẫn thẳng tới đúng bài (Mục 5.9, mục 3).
const MODULE_LINKS = {
  math: "/hoc-tap?lesson=numbers",
  letters: "/hoc-tap/letters",
  alphabet: "/hoc-tap/letters",
  geometry: "/hoc-tap/shapes",
  shapes: "/hoc-tap/shapes",
  time: "/hoc-tap/time",
  reading: "/hoc-tap/stt",
};

const SKILL_LINKS = {
  alphabet_score: "/hoc-tap/letters",
  number_score: "/hoc-tap?lesson=numbers",
  math_score: "/hoc-tap?lesson=numbers",
  geometry_score: "/hoc-tap/shapes",
  time_score: "/hoc-tap/time",
  reading_score: "/hoc-tap/stt",
};

function moduleName(key) {
  return MODULE_NAMES[key] || key;
}

function formatTimeSpent(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours} giờ ${minutes} phút`;
  if (minutes > 0) return `${minutes} phút`;
  return `${total} giây`;
}

function isToday(value) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

export default function ParentDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const token = useMemo(() => getToken(), []);

  useEffect(() => {
    if (!token) {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    Promise.all([
      request("/auth/me", { token }),
      // Báo cáo hỏng thì vẫn cho phụ huynh vào trang, chỉ thiếu phần tóm tắt.
      request("/learning-results/dashboard", { token }).catch(() => null),
    ])
      .then(([authData, learningData]) => {
        if (cancelled) return;
        setUser(authData.user);
        saveSession(token, authData.user);
        setDashboard(learningData);
      })
      .catch(() => {
        if (cancelled) return;
        clearSession();
        router.replace("/login");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router, token]);

  async function handleLogout() {
    try {
      await request("/auth/logout", { method: "POST", token });
    } catch {
      // Đăng xuất tại máy vẫn phải chạy dù máy chủ tạm không trả lời.
    } finally {
      clearSession();
      router.replace("/login");
    }
  }

  if (loading) {
    return (
      <main className="dashboard-shell">
        <section className="dashboard-card">Đang mở khu vực quản lý...</section>
      </main>
    );
  }

  const summary = dashboard?.summary || {};
  const trend = dashboard?.trend || [];
  const latestWeek = trend[trend.length - 1] || null;
  const previousWeek = trend[trend.length - 2] || null;
  const recent = dashboard?.recent_results || [];
  const todayResults = recent.filter((item) => isToday(item.created_at));
  const skills = dashboard?.skill_statistics || [];
  const recommendations = dashboard?.recommendations || [];

  // Mục 5.9, mục 1: ô thứ tư so với tuần trước; tuần đầu thì ghi rõ.
  const weekDelta =
    latestWeek && previousWeek ? Math.round(latestWeek.score - previousWeek.score) : null;

  // Mục 5.9, mục 3: MỘT gợi ý hành động, kèm link mở đúng bài.
  const weakestSkill = skills
    .filter((item) => Number(item.attempts) > 0)
    .sort((a, b) => Number(a.score) - Number(b.score))[0];
  const firstRecommendation = recommendations[0];
  const suggestion = weakestSkill
    ? {
        text: `Bé đang yếu nhất ở ${String(weakestSkill.label).toLowerCase()}. Thử 5 phút luyện phần này nhé.`,
        href: SKILL_LINKS[weakestSkill.key] || "/hoc-tap",
        cta: `Mở bài ${weakestSkill.label}`,
      }
    : firstRecommendation
      ? {
          text: firstRecommendation.description || firstRecommendation.title,
          href: MODULE_LINKS[firstRecommendation.module_key] || "/hoc-tap",
          cta: "Mở bài học",
        }
      : {
          text: "Bé chưa học buổi nào. Hãy cùng bé mở một bài bất kỳ để bắt đầu.",
          href: "/hoc-tap",
          cta: "Vào lớp cho bé",
        };

  return (
    <main className="dashboard-shell">
      <section className="dashboard-card">
        <div className="dashboard-header">
          <div>
            <span className="badge">Khu vực quản lý</span>
            <h1>Xin chào, {user?.name || "phụ huynh"}!</h1>
            <p>Theo dõi việc học của bé và quản lý tài khoản.</p>
          </div>
          <div className="dashboard-actions">
            <ParentNav />
          </div>
        </div>

        {/* 1. Tóm tắt tuần – 4 ô (Mục 5.9) */}
        <h2 className="parent-section-title">Tóm tắt tuần này</h2>
        <div className="parent-summary-grid">
          <ParentStat
            label="Thời gian học"
            value={formatTimeSpent(summary.total_time_spent)}
          />
          <ParentStat
            label="Bài đã xong"
            value={`${Number(summary.total_results) || 0} bài`}
          />
          <ParentStat
            label="Chuỗi ngày học"
            value={`${Number(summary.current_streak_days) || 0} ngày`}
          />
          <ParentStat
            label="So với tuần trước"
            value={
              weekDelta === null
                ? "Tuần đầu tiên"
                : `${weekDelta >= 0 ? "+" : ""}${weekDelta} điểm`
            }
            muted={weekDelta === null}
          />
        </div>

        {/* 2. Hôm nay bé đã học (Mục 5.9) */}
        <h2 className="parent-section-title">Hôm nay bé đã học</h2>
        {todayResults.length ? (
          <ul className="parent-today-list">
            {todayResults.slice(0, 5).map((item) => (
              <li key={item.id} className="parent-today-item">
                <span className="parent-today-name">
                  {item.title || moduleName(item.module_key)}
                </span>
                <span className="parent-today-module">{moduleName(item.module_key)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="parent-empty">Hôm nay bé chưa học bài nào.</p>
        )}

        {/* 3. Một gợi ý hành động (Mục 5.9) */}
        <h2 className="parent-section-title">Gợi ý cho bố mẹ</h2>
        <div className="parent-suggestion">
          <p>{suggestion.text}</p>
          <Link href={suggestion.href} className="btn primary">
            {suggestion.cta}
          </Link>
        </div>

        {/* 4. Các nút chính (Mục 5.9) */}
        <h2 className="parent-section-title">Lối tắt</h2>
        <div className="parent-actions">
          <Link href="/hoc-tap" className="btn primary">
            Vào lớp cho bé
          </Link>
          <Link href="/dashboard/results" className="btn secondary">
            Xem báo cáo chi tiết
          </Link>
          <Link href="/dashboard/tools" className="btn secondary">
            Công cụ cho bé
          </Link>
          <Link href="/dashboard/settings" className="btn secondary">
            Cài đặt
          </Link>
          <button type="button" className="btn secondary" onClick={handleLogout}>
            Đăng xuất
          </button>
        </div>
      </section>
    </main>
  );
}

function ParentStat({ label, value, muted }) {
  return (
    <article className="parent-stat">
      <span className="parent-stat-label">{label}</span>
      <strong className={`parent-stat-value ${muted ? "muted" : ""}`}>{value}</strong>
    </article>
  );
}
