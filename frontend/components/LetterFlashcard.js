"use client";

import { useEffect, useState } from "react";
import { speakVietnamese } from "../lib/speech";
import RewardSummary from "./RewardSummary";
import styles from "../app/hoc-tap/letters/HocChu.module.css";

function wrapIndex(index, total) {
  if (total <= 0) {
    return 0;
  }

  return ((index % total) + total) % total;
}

function findInitialIndex(items, initialLetter) {
  if (!items.length) {
    return 0;
  }

  const target = String(initialLetter || "").trim();
  if (!target) {
    return 0;
  }

  const index = items.findIndex(
    (item) => item.letter === target || item.label === target || item.id === target
  );
  return index >= 0 ? index : 0;
}

export default function LetterFlashcard({ items = [], initialLetter = "", onHome }) {
  const [currentIndex, setCurrentIndex] = useState(() =>
    findInitialIndex(items, initialLetter)
  );
  const [flipped, setFlipped] = useState(false);
  // Xong MỘT VÒNG thẻ thì chúc mừng cấp 3 (Mục 6.3, bảng "chỗ gắn hiệu ứng").
  const [seen, setSeen] = useState(() => new Set());
  const [celebrated, setCelebrated] = useState(false);

  useEffect(() => {
    const start = findInitialIndex(items, initialLetter);
    setCurrentIndex(start);
    setFlipped(false);
    setSeen(new Set([start]));
    setCelebrated(false);
  }, [items, initialLetter]);

  const roundDone = items.length > 0 && seen.size >= items.length;

  useEffect(() => {
    if (roundDone && !celebrated) setCelebrated(true);
  }, [roundDone, celebrated]);

  if (!items.length) {
    return <div className="info">Chưa có dữ liệu flashcard.</div>;
  }

  const current = items[currentIndex] || items[0];

  const goToIndex = (nextIndex) => {
    const target = wrapIndex(nextIndex, items.length);
    setCurrentIndex(target);
    setFlipped(false);
    setSeen((prev) => {
      if (prev.has(target)) return prev;
      const next = new Set(prev);
      next.add(target);
      return next;
    });
  };

  const replayRound = () => {
    setSeen(new Set([currentIndex]));
    setCelebrated(false);
  };

  const speakLetter = () => speakVietnamese(current.sound || current.letter || current.label || "");
  const speakExample = () => speakVietnamese(current.example || current.word || "");

  const shuffledIndex = items.length <= 1 ? 0 : Math.floor(Math.random() * items.length);

  return (
    <section className={styles.flashcardSection}>
      <div className={styles.flashcardHeader}>
        <div>
          <span className="badge">Flashcard</span>
          <h2>Học chữ bằng thẻ</h2>
          <p>Bấm vào thẻ để lật, nghe phát âm và chuyển sang chữ khác.</p>
        </div>
        <span className="badge">
          Đã xem {seen.size}/{items.length} thẻ
        </span>
      </div>

      <div className={styles.flashcardStage}>
        <button
          type="button"
          className={styles.flashcardButton}
          onClick={() => setFlipped((value) => !value)}
          aria-label={`Lật thẻ ${current.letter}`}
        >
          <div
            className={`${styles.flashcardCard} ${
              flipped ? styles.flashcardCardFlipped : ""
            }`}
          >
            <div className={`${styles.flashcardFace} ${styles.flashcardFront}`}>
              <span className={styles.flashcardLabel}>Mặt trước</span>
              <div className={styles.flashcardLetter}>{current.letter}</div>
              <div className={styles.flashcardEmoji}>{current.emoji || "📘"}</div>
              <div className={styles.flashcardWord}>{current.word || ""}</div>
              <p className={styles.flashcardHint}>Chạm để lật thẻ</p>
            </div>

            <div className={`${styles.flashcardFace} ${styles.flashcardBack}`}>
              <span className={styles.flashcardLabel}>Mặt sau</span>
              <div className={styles.flashcardExample}>{current.example || current.word || ""}</div>
              <div className={styles.flashcardMeta}>
                <span className={styles.flashcardPill}>
                  Âm: {current.sound || current.letter}
                </span>
                <span className={styles.flashcardPill}>
                  Chữ thường: {current.letter.toLocaleLowerCase("vi-VN")}
                </span>
              </div>
              <div className={styles.flashcardBackActions}>
                <span
                  role="button"
                  tabIndex={0}
                  className={styles.flashcardBackBtn}
                  onClick={(event) => {
                    event.stopPropagation();
                    speakExample();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      speakExample();
                    }
                  }}
                >
                  🔊 Nghe ví dụ
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  className={styles.flashcardBackBtn}
                  onClick={(event) => {
                    event.stopPropagation();
                    goToIndex(shuffledIndex);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      goToIndex(shuffledIndex);
                    }
                  }}
                >
                  🔀 Xáo thẻ
                </span>
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Mục 5.5: giảm từ 7 nút xuống còn 3 nút to — ◀ · 🔊 · ▶.
          Lật thẻ bằng cách chạm vào chính thẻ. "Xáo thẻ" và "Nghe ví dụ"
          chuyển sang mặt sau của thẻ. */}
      <div className={styles.flashcardControls}>
        <button
          type="button"
          className="kbtn subject-let"
          onClick={() => goToIndex(currentIndex - 1)}
          disabled={items.length <= 1}
          aria-label="Thẻ trước"
        >
          ◀
        </button>
        <button
          type="button"
          className="kbtn subject-let"
          onClick={speakLetter}
          aria-label={`Nghe chữ ${current.letter}`}
        >
          🔊
        </button>
        <button
          type="button"
          className="kbtn subject-let"
          onClick={() => goToIndex(currentIndex + 1)}
          disabled={items.length <= 1}
          aria-label="Thẻ tiếp"
        >
          ▶
        </button>
      </div>

      <div className={styles.flashcardStrip}>
        {items.map((item, index) => (
          <button
            key={item.id || item.letter || item.label || index}
            type="button"
            className={`${styles.flashcardChip} ${
              index === currentIndex ? styles.flashcardChipActive : ""
            }`}
            onClick={() => goToIndex(index)}
          >
            {item.letter || item.label}
          </button>
        ))}
      </div>

      {celebrated ? (
        <RewardSummary
          stars={3}
          total={items.length}
          correctFirstTry={items.length}
          summaryText={`Con đã xem hết ${items.length} thẻ chữ!`}
          onReplay={replayRound}
          onHome={onHome || replayRound}
        />
      ) : null}
    </section>
  );
}
