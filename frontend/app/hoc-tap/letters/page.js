"use client";

import Link from "next/link";
import { useState } from "react";
import LetterFlashcard from "../../../components/LetterFlashcard";
import KidNav from "../../../components/KidNav";
import { recordLearningResult } from "../../../lib/learning";
import { speakVietnamese } from "../../../lib/speech";
import styles from "./HocChu.module.css";

const LETTER_ITEMS = [
  { letter: "A", sound: "a", emoji: "👕", word: "áo", example: "áo màu xanh" },
  { letter: "Ă", sound: "ă", emoji: "🍚", word: "ăn", example: "ăn cơm" },
  { letter: "Â", sound: "â", emoji: "🫖", word: "ấm", example: "ấm nước" },
  { letter: "B", sound: "bờ", emoji: "👶", word: "bé", example: "bé ngoan" },
  { letter: "C", sound: "cờ", emoji: "🐟", word: "cá", example: "cá vàng" },
  { letter: "D", sound: "dờ", emoji: "🐐", word: "dê", example: "dê con" },
  { letter: "Đ", sound: "đờ", emoji: "💡", word: "đèn", example: "đèn sáng" },
  { letter: "E", sound: "e", emoji: "🙂", word: "em", example: "em bé" },
  { letter: "Ê", sound: "ê", emoji: "🐸", word: "ếch", example: "ếch xanh" },
  { letter: "G", sound: "gờ", emoji: "🐔", word: "gà", example: "gà con" },
  { letter: "H", sound: "hờ", emoji: "🌸", word: "hoa", example: "hoa hồng" },
  { letter: "I", sound: "i", emoji: "🖨️", word: "in", example: "in hình" },
  { letter: "K", sound: "ca", emoji: "🍬", word: "kẹo", example: "kẹo ngọt" },
  { letter: "L", sound: "lờ", emoji: "🍃", word: "lá", example: "lá xanh" },
  { letter: "M", sound: "mờ", emoji: "🐱", word: "mèo", example: "mèo con" },
  { letter: "N", sound: "nờ", emoji: "🎀", word: "nơ", example: "nơ đỏ" },
  { letter: "O", sound: "o", emoji: "🐝", word: "ong", example: "ong mật" },
  { letter: "Ô", sound: "ô", emoji: "🚗", word: "ô tô", example: "ô tô đỏ" },
  { letter: "Ơ", sound: "ơ", emoji: "🌶️", word: "ớt", example: "ớt đỏ" },
  { letter: "P", sound: "pờ", emoji: "🍜", word: "phở", example: "phở thơm" },
  { letter: "Q", sound: "quờ", emoji: "🍊", word: "quả", example: "quả cam" },
  { letter: "R", sound: "rờ", emoji: "🧺", word: "rổ", example: "rổ tre" },
  { letter: "S", sound: "sờ", emoji: "⭐", word: "sao", example: "sao sáng" },
  { letter: "T", sound: "tờ", emoji: "🐰", word: "thỏ", example: "thỏ trắng" },
  { letter: "U", sound: "u", emoji: "🥤", word: "uống", example: "uống nước" },
  { letter: "Ư", sound: "ư", emoji: "🌱", word: "ươm", example: "ươm mầm" },
  { letter: "V", sound: "vờ", emoji: "🐘", word: "voi", example: "voi con" },
  { letter: "X", sound: "xờ", emoji: "🥭", word: "xoài", example: "xoài vàng" },
  { letter: "Y", sound: "y", emoji: "🧑‍⚕️", word: "y tá", example: "y tá chăm bé" },
];

export default function HocChu() {
  const [activeTab, setActiveTab] = useState("hoc");
  const [selectedLetter, setSelectedLetter] = useState(LETTER_ITEMS[0]);
  const [isAnimating, setIsAnimating] = useState(false);

  const speakLetter = (letter) => speakVietnamese(letter.sound);
  const speakWord = (letter) => speakVietnamese(letter.word);

  const selectLetter = (letter) => {
    if (letter.letter === selectedLetter.letter) {
      speakLetter(letter);
      void recordLearningResult({
        module_key: "letters",
        activity_key: "letter_explore",
        title: `Khám phá chữ ${letter.letter}`,
        score: 85,
        max_score: 100,
        accuracy: 85,
        time_spent_seconds: 0,
        detail: {
          letter: letter.letter,
          word: letter.word,
          example: letter.example,
          tab: activeTab,
        },
      });
      return;
    }

    setIsAnimating(true);
    window.setTimeout(() => {
      setSelectedLetter(letter);
      setIsAnimating(false);
      speakLetter(letter);
      void recordLearningResult({
        module_key: "letters",
        activity_key: "letter_explore",
        title: `Khám phá chữ ${letter.letter}`,
        score: 85,
        max_score: 100,
        accuracy: 85,
        time_spent_seconds: 0,
        detail: {
          letter: letter.letter,
          word: letter.word,
          example: letter.example,
          tab: activeTab,
        },
      });
    }, 180);
  };

  return (
    <main className="dashboard-shell">
      <section className="dashboard-card">
        <div className="dashboard-header">
          <div>
            <span className="badge">Dạy chữ</span>
            <h1>Học chữ cái</h1>
            <p>Nhìn, nghe và lật thẻ để ghi nhớ từng chữ cái tiếng Việt.</p>
          </div>
          <div className="dashboard-actions">
            <KidNav />
            <Link href="/hoc-tap" className="btn secondary">
              Quay lại
            </Link>
          </div>
        </div>

        <div className={styles.lessonContent}>
          <h1 className={styles.title}>🔤 Học chữ cái</h1>

          <div className={styles.tabBar}>
            <button
              className={`${styles.tab} ${activeTab === "hoc" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("hoc")}
            >
              📖 Học chữ
            </button>
            <button
              className={`${styles.tab} ${activeTab === "flashcard" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("flashcard")}
            >
              🃏 Flashcard
            </button>
          </div>

          {activeTab === "hoc" ? (
            <div className={styles.learnSection}>
              <div className={styles.alphabetGrid}>
                {LETTER_ITEMS.map((letter) => (
                  <button
                    key={letter.letter}
                    className={`${styles.letterBtn} ${
                      selectedLetter.letter === letter.letter ? styles.letterBtnActive : ""
                    }`}
                    onClick={() => selectLetter(letter)}
                  >
                    {letter.letter}
                  </button>
                ))}
              </div>

              <div className={`${styles.card} ${isAnimating ? styles.cardFade : ""}`}>
                <div className={styles.letterDisplay}>{selectedLetter.letter}</div>
                <div className={styles.emoji}>{selectedLetter.emoji}</div>
                <div className={styles.word}>{selectedLetter.word}</div>
                <div className={styles.example}>{selectedLetter.example}</div>
                <div className={styles.voiceActions}>
                  <button className="btn primary compact" onClick={() => speakLetter(selectedLetter)}>
                    Nghe chữ
                  </button>
                  <button className="btn secondary compact" onClick={() => speakWord(selectedLetter)}>
                    Nghe từ
                  </button>
                </div>

                <div className={styles.lowercaseRow}>
                  <span className={styles.lowercaseLabel}>Chữ thường:</span>
                  <span className={styles.lowercase}>
                    {selectedLetter.letter.toLocaleLowerCase("vi-VN")}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <LetterFlashcard items={LETTER_ITEMS} initialLetter={selectedLetter.letter} />
          )}
        </div>
      </section>
    </main>
  );
}
