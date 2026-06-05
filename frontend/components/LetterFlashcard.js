"use client";

import { useEffect, useState } from "react";
import { speakVietnamese } from "../lib/speech";
import { recordLearningResult } from "../lib/learning";
import styles from "../app/dashboard/letters/HocChu.module.css";

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

export default function LetterFlashcard({ items = [], initialLetter = "" }) {
  const [currentIndex, setCurrentIndex] = useState(() =>
    findInitialIndex(items, initialLetter)
  );
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    setCurrentIndex(findInitialIndex(items, initialLetter));
    setFlipped(false);
  }, [items, initialLetter]);

  if (!items.length) {
    return <div className="info">Chưa có dữ liệu flashcard.</div>;
  }

  const current = items[currentIndex] || items[0];

  useEffect(() => {
    void recordLearningResult({
      module_key: "letters",
      activity_key: "flashcard_view",
      title: `Flashcard chữ ${current.letter}`,
      score: 85,
      max_score: 100,
      accuracy: 85,
      time_spent_seconds: 0,
      detail: {
        letter: current.letter,
        word: current.word || "",
        example: current.example || "",
        index: currentIndex,
        total: items.length,
      },
    });
  }, [currentIndex, current.letter, current.example, current.word, items.length]);

  const goToIndex = (nextIndex) => {
    setCurrentIndex(wrapIndex(nextIndex, items.length));
    setFlipped(false);
  };

  const speakLetter = () => speakVietnamese(current.sound || current.letter || current.label || "");
  const speakWord = () => speakVietnamese(current.word || "");
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
          {currentIndex + 1}/{items.length}
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
              <p className={styles.flashcardHint}>Xem ví dụ và nghe lại âm</p>
            </div>
          </div>
        </button>
      </div>

      <div className={styles.flashcardControls}>
        <button
          className="btn secondary compact"
          type="button"
          onClick={() => goToIndex(currentIndex - 1)}
          disabled={items.length <= 1}
        >
          Thẻ trước
        </button>
        <button className="btn primary compact" type="button" onClick={speakLetter}>
          Nghe chữ
        </button>
        <button
          className="btn secondary compact"
          type="button"
          onClick={() => setFlipped((value) => !value)}
        >
          Lật thẻ
        </button>
        <button className="btn primary compact" type="button" onClick={speakWord}>
          Nghe từ
        </button>
        <button className="btn secondary compact" type="button" onClick={speakExample}>
          Nghe ví dụ
        </button>
        <button
          className="btn secondary compact"
          type="button"
          onClick={() => goToIndex(shuffledIndex)}
          disabled={items.length <= 1}
        >
          Xáo thẻ
        </button>
        <button
          className="btn secondary compact"
          type="button"
          onClick={() => goToIndex(currentIndex + 1)}
          disabled={items.length <= 1}
        >
          Thẻ tiếp
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
    </section>
  );
}
