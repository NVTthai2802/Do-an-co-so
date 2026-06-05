"use client";

import Link from "next/link";
import { useState } from "react";
import AirDrawActivity from "../../../components/AirDrawActivity";
import LessonNav from "../../../components/LessonNav";
import { speakVietnamese } from "../../../lib/speech";
import styles from "./HocChu.module.css";;

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

const ALPHABET = LETTER_ITEMS.map((item) => item.letter);
const CHU_DATA = Object.fromEntries(LETTER_ITEMS.map((item) => [item.letter, item]));

function drawLetterTemplate(letter) {
  return (ctx, width, height) => {
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${Math.round(height * 0.78)}px Arial, sans-serif`;
    ctx.fillText(letter, width / 2, height / 2 + height * 0.04);
  };
}

const CAMERA_LETTERS = ALPHABET.map((letter) => ({
  id: letter,
  label: letter,
  speech: CHU_DATA[letter].sound,
  color: "#5e74f6",
  preview: <span className={styles.cameraLetterPreview}>{letter}</span>,
  aliases: [letter, CHU_DATA[letter].sound, `chu ${letter}`, `chữ ${letter}`],
  drawTemplate: drawLetterTemplate(letter),
}));

export default function HocChu() {
  const [activeTab, setActiveTab] = useState("hoc"); // "hoc" | "camera"
  const [selectedLetter, setSelectedLetter] = useState("A");
  const [isAnimating, setIsAnimating] = useState(false);

  const speakLetter = (letter) => speakVietnamese(CHU_DATA[letter].sound);
  const speakWord = (letter) => speakVietnamese(CHU_DATA[letter].word);

  const selectLetter = (letter) => {
    if (letter === selectedLetter) {
      speakLetter(letter);
      return;
    }
    setIsAnimating(true);
    setTimeout(() => {
      setSelectedLetter(letter);
      setIsAnimating(false);
      speakLetter(letter);
    }, 200);
  };

  const info = CHU_DATA[selectedLetter];

  return (
    <main className="dashboard-shell">
      <section className="dashboard-card">
        <div className="dashboard-header">
          <div>
            <span className="badge">Dạy chữ</span>
            <h1>Học Chữ Cái</h1>
          </div>
          <div className="dashboard-actions">
            <LessonNav />
            <Link href="/dashboard" className="btn secondary">
              Quay lại
            </Link>
          </div>
        </div>

        <div className={styles.lessonContent}>
      <h1 className={styles.title}>🔤 Học Chữ Cái</h1>

      {/* Tab bar */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${activeTab === "hoc" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("hoc")}
        >
          📖 Học Chữ
        </button>
        <button
          className={`${styles.tab} ${activeTab === "camera" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("camera")}
        >
          📷 Nhận Dạng
        </button>
      </div>

      {/* ===== TAB HỌC CHỮ ===== */}
      {activeTab === "hoc" && (
        <div className={styles.learnSection}>
          {/* Alphabet grid */}
          <div className={styles.alphabetGrid}>
            {ALPHABET.map((letter) => (
              <button
                key={letter}
                className={`${styles.letterBtn} ${selectedLetter === letter ? styles.letterBtnActive : ""}`}
                onClick={() => selectLetter(letter)}
              >
                {letter}
              </button>
            ))}
          </div>

          {/* Detail card */}
          <div className={`${styles.card} ${isAnimating ? styles.cardFade : ""}`}>
            <div className={styles.letterDisplay}>{selectedLetter}</div>
            <div className={styles.emoji}>{info.emoji}</div>
            <div className={styles.word}>{info.word}</div>
            <div className={styles.example}>{info.example}</div>
            <div className={styles.voiceActions}>
              <button className="btn primary compact" onClick={() => speakLetter(selectedLetter)}>
                Nghe chữ
              </button>
              <button className="btn secondary compact" onClick={() => speakWord(selectedLetter)}>
                Nghe từ
              </button>
            </div>

            {/* lowercase */}
            <div className={styles.lowercaseRow}>
              <span className={styles.lowercaseLabel}>Chữ thường:</span>
              <span className={styles.lowercase}>
                {selectedLetter.toLocaleLowerCase("vi-VN")}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ===== TAB CAMERA ===== */}
      {activeTab === "camera" && (
        <AirDrawActivity
          activityLabel="chữ"
          endpoint="/api/recognize-letter"
          items={CAMERA_LETTERS}
        />
      )}
        </div>
      </section>
    </main>
  );
}
