"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LessonNav from "../../../components/LessonNav";
import { clearSession, getToken, saveSession } from "../../../lib/auth";
import { request } from "../../../lib/api";
import styles from "./Results.module.css";

function formatPercent(value) {
  const number = Number.isFinite(value) ? value : 0;
  return `${Math.round(number)}%`;
}

function formatInteger(value) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(value || 0));
}

function formatDate(value) {
  if (!value) return "Chưa có";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa có";

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatShortDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatTimeSpent(seconds) {
  const total = Math.max(0, Math.round(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (hours > 0) {
    return `${hours} giờ ${minutes} phút`;
  }
  if (minutes > 0) {
    return `${minutes} phút`;
  }
  return `${total} giây`;
}

function toneClass(score) {
  if (score >= 85) return styles.toneGood;
  if (score >= 70) return styles.toneWarn;
  return styles.toneDanger;
}

function toneLabel(score) {
  if (score >= 85) return "Xanh";
  if (score >= 70) return "Vàng";
  return "Đỏ";
}

function levelLabel(score) {
  if (score >= 90) return "Xuất sắc";
  if (score >= 80) return "Tốt";
  if (score >= 70) return "Khá";
  return "Cần cố gắng";
}

function buildChartGeometry(points, width = 720, height = 300, padding = 36) {
  const safePoints = points.length > 0 ? points : [{ label: "Tuần 1", score: 0, range_label: "" }];
  const innerWidth = Math.max(1, width - padding * 2);
  const innerHeight = Math.max(1, height - padding * 2);
  const denominator = Math.max(1, safePoints.length - 1);

  const plotPoints = safePoints.map((point, index) => {
    const score = Math.max(0, Math.min(100, Number(point.score) || 0));
    const x = padding + (innerWidth * index) / denominator;
    const y = padding + innerHeight * (1 - score / 100);
    return { ...point, x, y };
  });

  const linePoints = plotPoints.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPath =
    plotPoints.length > 0
      ? `${plotPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")} L ${
          plotPoints[plotPoints.length - 1].x
        } ${height - padding} L ${plotPoints[0].x} ${height - padding} Z`
      : "";

  return { plotPoints, linePoints, areaPath, width, height, padding };
}

function ScoreRing({ score, label }) {
  const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (safeScore / 100) * circumference;
  const tone = safeScore >= 85 ? styles.ringGood : safeScore >= 70 ? styles.ringWarn : styles.ringDanger;

  return (
    <div className={styles.ringCard}>
      <div className={styles.ringWrap}>
        <svg viewBox="0 0 160 160" className={styles.ringSvg} aria-hidden="true">
          <circle cx="80" cy="80" r={radius} className={styles.ringTrack} />
          <circle
            cx="80"
            cy="80"
            r={radius}
            className={`${styles.ringProgress} ${tone}`}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div className={styles.ringValue}>{Math.round(safeScore)}</div>
        <div className={styles.ringLabel}>{label}</div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, hint, tone = "neutral" }) {
  return (
    <article className={`${styles.summaryCard} ${styles[`summary${tone}`] || ""}`}>
      <span className={styles.summaryLabel}>{label}</span>
      <strong className={styles.summaryValue}>{value}</strong>
      {hint ? <p className={styles.summaryHint}>{hint}</p> : null}
    </article>
  );
}

function SkillCard({ item }) {
  const score = Math.max(0, Math.min(100, Number(item.score) || 0));
  return (
    <article className={`${styles.skillCard} ${toneClass(score)}`}>
      <div className={styles.skillTop}>
        <div>
          <span className={styles.skillLabel}>{item.label}</span>
          <div className={styles.skillMeta}>
            {item.attempts || 0} lần luyện
          </div>
        </div>
        <div className={styles.skillScore}>{formatPercent(score)}</div>
      </div>

      <div className={styles.skillBarTrack} aria-hidden="true">
        <span className={styles.skillBarFill} style={{ width: `${score}%` }} />
      </div>

      <div className={styles.skillFooter}>
        <span className={styles.skillLevel}>{toneLabel(score)}</span>
        <span className={styles.skillHint}>Mức hiện tại</span>
      </div>
    </article>
  );
}

function StatPill({ label, value }) {
  return (
    <div className={styles.statPill}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RecommendationCard({ item, index }) {
  return (
    <article className={styles.recommendationCard}>
      <div className={styles.recommendationHead}>
        <span className={styles.recommendationIndex}>{index + 1}</span>
        <div>
          <h3>{item.title}</h3>
          <p>{item.reason}</p>
        </div>
      </div>
      <div className={styles.recommendationActions}>
        {item.actions?.map((action) => (
          <span key={action} className={styles.actionChip}>
            {action}
          </span>
        ))}
      </div>
    </article>
  );
}

function BadgeCloud({ badges }) {
  if (!badges.length) {
    return <div className={styles.emptyState}>Chưa có huy hiệu nào được mở.</div>;
  }

  return (
    <div className={styles.badgeCloud}>
      {badges.map((badge) => (
        <div key={badge.name} className={styles.badgeItem}>
          <strong>{badge.name}</strong>
          <span>{badge.description}</span>
        </div>
      ))}
    </div>
  );
}

function DocumentComparison({ current, previous }) {
  if (!current && !previous) {
    return <div className={styles.emptyState}>Chưa có tài liệu để so sánh.</div>;
  }

  return (
    <div className={styles.documentCompare}>
      <article className={styles.documentCard}>
        <div className={styles.documentHead}>
          <span className={styles.documentTag}>Bài viết hôm nay</span>
          <strong>{formatDate(current?.created_at)}</strong>
        </div>
        <h3>{current?.source_name || "Tài liệu gần nhất"}</h3>
        <p>{current?.summary_text || "Chưa có tóm tắt."}</p>
        <div className={styles.documentMeta}>
          <span>{formatInteger(current?.sentence_count)} câu</span>
          <span>{formatInteger(current?.summary_length)} ký tự tóm tắt</span>
        </div>
      </article>

      <article className={styles.documentCard}>
        <div className={styles.documentHead}>
          <span className={styles.documentTagMuted}>Bài viết tuần trước</span>
          <strong>{formatDate(previous?.created_at)}</strong>
        </div>
        <h3>{previous?.source_name || "Tài liệu trước đó"}</h3>
        <p>{previous?.summary_text || "Chưa có tài liệu trước đó."}</p>
        <div className={styles.documentMeta}>
          <span>{formatInteger(previous?.sentence_count)} câu</span>
          <span>{formatInteger(previous?.summary_length)} ký tự tóm tắt</span>
        </div>
      </article>
    </div>
  );
}

export default function LearningResultsDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const token = useMemo(() => getToken(), []);

  useEffect(() => {
    if (!token) {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    async function loadDashboard() {
      try {
        const [authData, learningData] = await Promise.all([
          request("/auth/me", { token }),
          request("/learning-results/dashboard", { token }),
        ]);

        if (cancelled) return;

        setUser(authData.user);
        saveSession(token, authData.user);
        setDashboard(learningData);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError.message || "Không tải được báo cáo học tập.");
        clearSession();
        router.replace("/login");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [router, token]);

  const summary = dashboard?.summary || {};
  const profile = dashboard?.profile || {};
  const trend = dashboard?.trend || [];
  const skills = dashboard?.skill_statistics || [];
  const ali = dashboard?.ali || { score: 0, label: "Chưa có dữ liệu", note: "", components: [] };
  const cameraResults = dashboard?.camera_results || { summary: {}, items: [], insight: "" };
  const readingResults = dashboard?.reading_results || { summary: {}, wrong_words: [], insight: "", documents: [] };
  const badges = dashboard?.badges || [];
  const recommendations = dashboard?.recommendations || [];
  const recentResults = dashboard?.recent_results || [];

  const totalTimeSpent = summary.total_time_spent || 0;
  const trendGeometry = useMemo(() => buildChartGeometry(trend), [trend]);
  const latestTrend = trend[trend.length - 1] || null;
  const previousTrend = trend[trend.length - 2] || null;
  const trendDelta = latestTrend && previousTrend ? Math.round(latestTrend.score - previousTrend.score) : 0;

  if (loading) {
    return (
      <main className="dashboard-shell">
        <section className="dashboard-card">Đang tổng hợp kết quả học tập...</section>
      </main>
    );
  }

  if (error && !dashboard) {
    return (
      <main className="dashboard-shell">
        <section className="dashboard-card">
          <div className="dashboard-header">
            <div>
              <span className="badge">Báo cáo học tập</span>
              <h1>Không tải được dữ liệu</h1>
              <p>{error}</p>
            </div>
            <Link href="/dashboard" className="btn secondary">
              Quay lại
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={`dashboard-shell ${styles.pageShell}`}>
      <nav className={styles.navBar}>
        <LessonNav />
        <Link href="/dashboard" className={styles.navBack}>
          ← Quay lại
        </Link>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className="badge">Dành cho phụ huynh</span>
          <h1>Kết quả học tập</h1>
          <p>
            Báo cáo này tổng hợp tiến độ học chữ, học số, hình học, phép toán, luyện đọc
            và các kết quả AI camera để phụ huynh nhìn thấy xu hướng học tập của bé theo tuần.
          </p>

          <div className={styles.heroMeta}>
            <StatPill label="Tên bé" value={profile.name || user?.name || "Bé"} />
            <StatPill label="Tổng bài" value={formatInteger(summary.total_results)} />
            <StatPill label="Chuỗi học" value={`${summary.current_streak_days || 0} ngày`} />
            <StatPill label="Huy hiệu" value={formatInteger(summary.badges_count || badges.length)} />
            <StatPill label="Thời gian" value={formatTimeSpent(totalTimeSpent)} />
          </div>
        </div>

        <ScoreRing score={ali.score} label={ali.label} />
      </section>

      <section className={styles.summaryGrid}>
        <SummaryCard
          label="Điểm trung bình"
          value={formatPercent(summary.average_score)}
          hint={`Mức xếp loại: ${levelLabel(summary.average_score || 0)}`}
          tone="Blue"
        />
        <SummaryCard
          label="Chuỗi học tập"
          value={`${summary.current_streak_days || 0} ngày`}
          hint={`Kỷ lục: ${summary.best_streak_days || 0} ngày liên tiếp`}
          tone="Teal"
        />
        <SummaryCard
          label="Bài đã hoàn thành"
          value={formatInteger(summary.total_results)}
          hint={`${summary.module_count || 0} module đang hoạt động`}
          tone="Amber"
        />
        <SummaryCard
          label="Huy hiệu đạt được"
          value={formatInteger(summary.badges_count || badges.length)}
          hint={badges.length ? "Đã mở thêm phần thưởng" : "Hãy bắt đầu một phiên học"}
          tone="Rose"
        />
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <span className={styles.sectionLabel}>Tiến độ học tập</span>
            <h2>Biểu đồ tiến độ theo tuần</h2>
            <p>Đường biểu diễn thể hiện điểm trung bình của từng tuần gần nhất.</p>
          </div>
          <div className={styles.trendMeta}>
            <strong>{trendDelta >= 0 ? "+" : ""}{trendDelta} điểm</strong>
            <span>So với tuần trước</span>
          </div>
        </div>

        <div className={styles.chartLayout}>
          <div className={styles.chartWrap}>
            <svg
              viewBox={`0 0 ${trendGeometry.width} ${trendGeometry.height}`}
              className={styles.chartSvg}
              role="img"
              aria-label="Biểu đồ tiến độ học tập"
            >
              <defs>
                <linearGradient id="trendLine" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#5e74f6" />
                  <stop offset="50%" stopColor="#2dd4bf" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
                <linearGradient id="trendFill" x1="0%" y1="0%" x2="0%" y2="1%">
                  <stop offset="0%" stopColor="rgba(94, 116, 246, 0.28)" />
                  <stop offset="100%" stopColor="rgba(94, 116, 246, 0.04)" />
                </linearGradient>
              </defs>

              {[100, 75, 50, 25, 0].map((tick) => {
                const y = trendGeometry.padding + (trendGeometry.height - trendGeometry.padding * 2) * (1 - tick / 100);
                return (
                  <g key={tick}>
                    <line
                      x1={trendGeometry.padding}
                      y1={y}
                      x2={trendGeometry.width - trendGeometry.padding}
                      y2={y}
                      className={styles.chartGridLine}
                    />
                    <text x="8" y={y + 4} className={styles.chartTick}>
                      {tick}
                    </text>
                  </g>
                );
              })}

              {trendGeometry.areaPath ? <path d={trendGeometry.areaPath} className={styles.chartArea} /> : null}
              {trendGeometry.linePoints ? (
                <polyline points={trendGeometry.linePoints} className={styles.chartLine} />
              ) : null}

              {trendGeometry.plotPoints.map((point) => (
                <g key={point.label}>
                  <circle cx={point.x} cy={point.y} r="6" className={styles.chartDot} />
                  <circle cx={point.x} cy={point.y} r="12" className={styles.chartHalo} />
                </g>
              ))}
            </svg>

            <div className={styles.chartLabels}>
              {trendGeometry.plotPoints.map((point) => (
                <div key={point.label} className={styles.chartLabel}>
                  <strong>{point.label}</strong>
                  <span>{point.range_label}</span>
                </div>
              ))}
            </div>
          </div>

          <aside className={styles.chartAside}>
            <div className={styles.asideCard}>
              <span className={styles.asideLabel}>Tuần này</span>
              <strong>{formatPercent(latestTrend?.score || 0)}</strong>
              <p>{latestTrend?.range_label || "Chưa đủ dữ liệu"}</p>
            </div>
            <div className={styles.asideCard}>
              <span className={styles.asideLabel}>Tuần trước</span>
              <strong>{formatPercent(previousTrend?.score || 0)}</strong>
              <p>{previousTrend?.range_label || "Chưa đủ dữ liệu"}</p>
            </div>
            <div className={styles.asideCardAccent}>
              <span className={styles.asideLabel}>Nhận xét của AI</span>
              <p>{ali.note}</p>
            </div>
          </aside>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <span className={styles.sectionLabel}>Kỹ năng</span>
            <h2>Thống kê theo từng kỹ năng</h2>
            <p>
              Màu xanh là kỹ năng đang vững, vàng là cần củng cố thêm, đỏ là nên luyện lại.
            </p>
          </div>
        </div>
        <div className={styles.skillGrid}>
          {skills.map((item) => (
            <SkillCard key={item.key} item={item} />
          ))}
        </div>
      </section>

      <section className={styles.dualGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.sectionLabel}>AI Camera</span>
              <h2>Kết quả AI camera</h2>
              <p>Đánh giá từ các bài nhận diện hình và phép toán bằng camera.</p>
            </div>
          </div>

          {cameraResults.items?.length ? (
            <div className={styles.cameraGrid}>
              {cameraResults.items.map((item) => (
                <article key={item.label} className={styles.cameraItem}>
                  <div className={styles.cameraTop}>
                    <div>
                      <strong>{item.label}</strong>
                      <span>{item.attempts} lần thử</span>
                    </div>
                    <div className={styles.cameraScore}>{formatPercent(item.score)}</div>
                  </div>
                  <div className={styles.skillBarTrack} aria-hidden="true">
                    <span className={styles.skillBarFill} style={{ width: `${item.score}%` }} />
                  </div>
                  <div className={styles.cameraMeta}>
                    <span>{item.status}</span>
                    <span>Điểm cao nhất: {formatPercent(item.best_score)}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              Chưa có dữ liệu AI camera. Hãy thử bài Học hình hoặc phép toán bằng camera.
            </div>
          )}

          <div className={styles.asideCardAccent}>
            <span className={styles.asideLabel}>Nhận xét tự động</span>
            <p>{cameraResults.insight}</p>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.sectionLabel}>Luyện đọc</span>
              <h2>Kết quả luyện đọc</h2>
              <p>Thống kê từ phiên đọc bằng giọng nói và tài liệu OCR gần nhất.</p>
            </div>
          </div>

          <div className={styles.readingStats}>
            <StatPill label="Số từ đã đọc" value={formatInteger(readingResults.summary?.total_words)} />
            <StatPill label="Độ chính xác" value={formatPercent(readingResults.summary?.average_accuracy)} />
            <StatPill label="Tốc độ đọc" value={`${formatInteger(readingResults.summary?.speed_wpm)} từ/phút`} />
            <StatPill label="Mức độ" value={readingResults.summary?.level || "Chưa có"} />
          </div>

          <div className={styles.asideCardAccent}>
            <span className={styles.asideLabel}>Gợi ý từ AI</span>
            <p>{readingResults.insight}</p>
          </div>

          <div className={styles.readingWrongList}>
            {readingResults.wrong_words?.length ? (
              readingResults.wrong_words.map((word) => (
                <span key={word} className={styles.readingWrongChip}>
                  {word}
                </span>
              ))
            ) : (
              <span className={styles.emptyState}>Chưa ghi nhận từ đọc sai.</span>
            )}
          </div>
        </section>
      </section>

      <section className={styles.dualGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.sectionLabel}>Báo cáo tuần</span>
              <h2>Tuần nào tiến bộ, tuần nào chững lại</h2>
            </div>
          </div>

          <div className={styles.reportList}>
            {dashboard?.weekly_report?.map((week, index) => {
              const previousWeek = dashboard.weekly_report[index - 1];
              const delta = previousWeek ? Math.round(week.score - previousWeek.score) : 0;
              return (
                <article key={week.label} className={styles.reportItem}>
                  <div>
                    <strong>{week.label}</strong>
                    <span>{week.range_label}</span>
                  </div>
                  <div className={styles.reportScore}>
                    <strong>{formatPercent(week.score)}</strong>
                    <span>{delta >= 0 ? "+" : ""}{delta} điểm</span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.sectionLabel}>Gợi ý AI</span>
              <h2>Khuyến nghị học tập</h2>
              <p>Gợi ý tự động dựa trên kỹ năng yếu, xu hướng tuần và kết quả camera.</p>
            </div>
          </div>

          <div className={styles.recommendationList}>
            {recommendations.map((item, index) => (
              <RecommendationCard key={item.title + index} item={item} index={index} />
            ))}
          </div>
        </section>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <span className={styles.sectionLabel}>Huy hiệu</span>
            <h2>Phần thưởng đã đạt được</h2>
          </div>
        </div>
        <BadgeCloud badges={badges} />
      </section>


      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <span className={styles.sectionLabel}>Lịch sử gần nhất</span>
            <h2>Hoạt động học tập gần đây</h2>
          </div>
        </div>

        <div className={styles.timelineList}>
          {recentResults.length ? (
            recentResults.map((result) => (
              <article key={result.id} className={styles.timelineItem}>
                <div>
                  <strong>{result.title}</strong>
                  <span>{result.module_key}</span>
                </div>
                <div className={styles.timelineMeta}>
                  <strong>{formatPercent(result.score)}</strong>
                  <span>{formatShortDate(result.created_at)}</span>
                </div>
              </article>
            ))
          ) : (
            <div className={styles.emptyState}>Chưa có lịch sử học tập gần đây.</div>
          )}
        </div>
      </section>
    </main>
  );
}
