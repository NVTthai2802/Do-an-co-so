"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clearSession, getToken, saveSession } from "../../../lib/auth";
import { request } from "../../../lib/api";
import { speakVietnamese } from "../../../lib/speech";
import { celebrateCorrect } from "../../../lib/celebrate";
import { sfx } from "../../../lib/sfx";
import KidTopBar from "../../../components/KidTopBar";
import Mascot from "../../../components/Mascot";

const SEEN_KEY = "kl_seen_badges";

function readSeen() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSeen(ids) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
  } catch {
    // Không lưu được thì thôi, chỉ mất dải "Mới!".
  }
}

/**
 * Phòng huy hiệu của bé (Mục 5.11).
 *
 * Không so sánh với bạn khác, không bảng xếp hạng. Bé chạm vào một huy hiệu
 * thì nghe đọc mô tả, nên bé chưa biết đọc vẫn hiểu được.
 */
export default function BadgeRoomPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState([]);
  const [totalStars, setTotalStars] = useState(0);
  const [seen, setSeen] = useState([]);
  const [selected, setSelected] = useState(null);
  const token = useMemo(() => getToken(), []);
  const celebratedRef = useRef(false);

  useEffect(() => {
    if (!token) {
      router.replace("/login");
      return;
    }

    let cancelled = false;
    setSeen(readSeen());

    request("/learning-results/dashboard", { token })
      .then((data) => {
        if (cancelled) return;
        // Chỉ lấy huy hiệu dành cho bé: "Tài liệu thông minh" có kid_name rỗng
        // nên không xuất hiện ở đây (Mục 5.11).
        setCatalog((data.badge_catalog || []).filter((item) => item.kid_name));
        setTotalStars(Number(data.summary?.total_stars) || 0);
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

  const earnedUnseen = catalog.filter((item) => item.earned && !seen.includes(item.id));

  // Lần đầu mở trang, huy hiệu mới lật ra kèm pháo giấy nhỏ (Mục 5.11).
  const gridRef = useRef(null);
  useEffect(() => {
    if (loading || celebratedRef.current || !earnedUnseen.length) return;
    celebratedRef.current = true;
    const first = gridRef.current?.querySelector(".badge-tile.is-new");
    celebrateCorrect(first);
    sfx.correct();
  }, [loading, earnedUnseen.length]);

  const openBadge = useCallback((item) => {
    setSelected(item);
    speakVietnamese(item.earned ? `${item.kid_name}. ${item.kid_description}` : item.kid_description);

    // Xem rồi thì bỏ dải "Mới!".
    setSeen((prev) => {
      if (prev.includes(item.id)) return prev;
      const next = [...prev, item.id];
      writeSeen(next);
      return next;
    });
  }, []);

  if (loading) {
    return (
      <main className="kid-shell">
        <KidTopBar subject="num" title="Huy hiệu" />
        <div className="kid-lesson subject-num">
          <p className="kid-skeleton-text" role="status">
            Đang mở phòng huy hiệu...
          </p>
        </div>
      </main>
    );
  }

  const earnedCount = catalog.filter((item) => item.earned).length;

  return (
    <main className="kid-shell">
      <KidTopBar subject="num" title="Huy hiệu" />

      <div className="kid-lesson subject-num">
        <header className="badge-room-head">
          <Mascot mood="happy" size={72} />
          <div>
            <h2>Bộ sưu tập của bé</h2>
            <p>
              Bé đã có {earnedCount} huy hiệu
              {earnedCount === 0 ? ". Học một bài để mở chiếc đầu tiên nhé!" : "!"}
            </p>
          </div>
          <span className="badge-room-stars" aria-label={`${totalStars} sao`}>
            <span aria-hidden="true">⭐</span> {totalStars} sao
          </span>
        </header>

        <div className="badge-grid" ref={gridRef}>
          {catalog.map((item) => {
            const isNew = item.earned && !seen.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                className={`badge-tile ${item.earned ? "is-earned" : "is-locked"} ${
                  isNew ? "is-new" : ""
                }`}
                onClick={() => openBadge(item)}
                aria-label={`${item.kid_name}${item.earned ? ", đã đạt" : ", chưa đạt"}`}
              >
                <span className={`badge-medal tone-${item.tone}`}>
                  <span aria-hidden="true">{item.icon}</span>
                  {!item.earned ? (
                    <span className="badge-lock" aria-hidden="true">
                      🔒
                    </span>
                  ) : null}
                </span>

                <b>{item.kid_name}</b>

                {/* Chưa đạt: tiến độ bằng chấm, KHÔNG dùng phần trăm (Mục 5.11) */}
                {!item.earned ? (
                  <ProgressDots current={item.progress.current} target={item.progress.target} />
                ) : null}

                {isNew ? <span className="badge-new-tag">Mới!</span> : null}
              </button>
            );
          })}
        </div>

        {selected ? (
          <div className="badge-detail" role="status">
            <span className={`badge-medal tone-${selected.tone} ${selected.earned ? "" : "locked"}`}>
              <span aria-hidden="true">{selected.icon}</span>
            </span>
            <div>
              <strong>{selected.kid_name}</strong>
              <p>{selected.kid_description}</p>
              {!selected.earned ? (
                <span className="badge-detail-progress">
                  Còn {Math.max(0, selected.progress.target - selected.progress.current)} nữa thôi!
                </span>
              ) : null}
            </div>
            <button
              type="button"
              className="badge-detail-speak"
              aria-label="Nghe lại"
              onClick={() =>
                speakVietnamese(
                  selected.earned
                    ? `${selected.kid_name}. ${selected.kid_description}`
                    : selected.kid_description
                )
              }
            >
              🔊
            </button>
          </div>
        ) : (
          <p className="badge-hint">Chạm vào một huy hiệu để nghe kể về nó.</p>
        )}
      </div>
    </main>
  );
}

/** Tiến độ bằng chấm, tối đa 5 chấm cho gọn (Mục 5.11). */
function ProgressDots({ current, target }) {
  const dots = Math.min(target, 5);
  const filled = target > 0 ? Math.round((current / target) * dots) : 0;

  return (
    <span className="badge-dots" aria-label={`${current} trên ${target}`}>
      {Array.from({ length: dots }, (_, index) => (
        <i key={index} className={index < filled ? "on" : ""} aria-hidden="true" />
      ))}
    </span>
  );
}
