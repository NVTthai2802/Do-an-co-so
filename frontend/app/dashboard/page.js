"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clearSession, getToken, saveSession } from "../../lib/auth";
import { request } from "../../lib/api";

export default function ParentDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const token = useMemo(() => getToken(), []);

  useEffect(() => {
    if (!token) {
      router.replace("/login");
      return;
    }

    request("/auth/me", { token })
      .then((data) => {
        setUser(data.user);
        saveSession(token, data.user);
      })
      .catch(() => {
        clearSession();
        router.replace("/login");
      })
      .finally(() => setLoading(false));
  }, [router, token]);

  async function handleLogout() {
    try {
      await request("/auth/logout", { method: "POST", token });
    } catch {
      // Local logout should still work if the server is temporarily unavailable.
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

  return (
    <main className="dashboard-shell">
      <section className="dashboard-card">
        <div className="dashboard-header">
          <div>
            <span className="badge">Khu vực quản lý</span>
            <h1>Xin chào, {user?.name || "phụ huynh"}!</h1>
            <p>Theo dõi kết quả học tập của bé và quản lý tài khoản.</p>
          </div>
          <div className="dashboard-actions">
            <Link href="/hoc-tap" className="btn primary">
              Chuyển sang giao diện học tập
            </Link>
            <button className="btn secondary" onClick={handleLogout}>
              Đăng xuất
            </button>
          </div>
        </div>

        <div className="lesson-grid">
          <Link href="/dashboard/results" className="lesson-card">
            <div className="lesson-icon">📊</div>
            <h2>Kết quả học tập</h2>
            <p>Xem tiến độ, kỹ năng, chuỗi học tập và gợi ý AI cho phụ huynh.</p>
            <div className="lesson-cta">Xem báo cáo →</div>
          </Link>
        </div>
      </section>
    </main>
  );
}
