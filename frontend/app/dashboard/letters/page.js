"use client";

import Link from "next/link";
import { useState } from "react";
import AirDrawActivity from "../../../components/AirDrawActivity";
import styles from "./HocChu.module.css";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const CHU_DATA = {
  A: { emoji: "🍎", word: "Ăn", example: "A như Ăn cơm" },
  B: { emoji: "🦋", word: "Bướm", example: "B như Bướm bay" },
  C: { emoji: "🐱", word: "Cá", example: "C như Cá vàng" },
  D: { emoji: "🍉", word: "Dưa", example: "D như Dưa hấu" },
  E: { emoji: "🦅", word: "Ếch", example: "E như Ếch xanh" },
  F: { emoji: "🌺", word: "Flower", example: "F như Flower đẹp" },
  G: { emoji: "🐔", word: "Gà", example: "G như Gà con" },
  H: { emoji: "🌸", word: "Hoa", example: "H như Hoa hồng" },
  I: { emoji: "🎁", word: "ích", example: "I như Ích lợi" },
  J: { emoji: "🧃", word: "Juice", example: "J như Juice thơm" },
  K: { emoji: "🍬", word: "Kẹo", example: "K như Kẹo ngọt" },
  L: { emoji: "🍃", word: "Lá", example: "L như Lá xanh" },
  M: { emoji: "🐱", word: "Mèo", example: "M như Mèo con" },
  N: { emoji: "🌙", word: "Núi", example: "N như Núi cao" },
  O: { emoji: "🐞", word: "Ốc", example: "O như Ốc sên" },
  P: { emoji: "🎨", word: "Phố", example: "P như Phố đẹp" },
  Q: { emoji: "🍊", word: "Quả", example: "Q như Quả cam" },
  R: { emoji: "🐉", word: "Rồng", example: "R như Rồng bay" },
  S: { emoji: "🌟", word: "Sao", example: "S như Sao sáng" },
  T: { emoji: "🌳", word: "Thỏ", example: "T như Thỏ trắng" },
  U: { emoji: "🦄", word: "Unicorn", example: "U như Unicorn" },
  V: { emoji: "🦆", word: "Vịt", example: "V như Vịt vàng" },
  W: { emoji: "🌊", word: "Water", example: "W như Water xanh" },
  X: { emoji: "🥝", word: "Xoài", example: "X như Xoài vàng" },
  Y: { emoji: "🌻", word: "Yêu", example: "Y như Yêu thương" },
  Z: { emoji: "⚡", word: "Zip", example: "Z như Zip nhanh" },
};

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
  speech: `chữ ${letter}`,
  color: "#5e74f6",
  preview: <span className={styles.cameraLetterPreview}>{letter}</span>,
  aliases: [letter, `letter ${letter}`, `chu ${letter}`, `chữ ${letter}`],
  drawTemplate: drawLetterTemplate(letter),
}));

export default function HocChu() {
  const [activeTab, setActiveTab] = useState("hoc"); // "hoc" | "camera"
  const [selectedLetter, setSelectedLetter] = useState("A");
  const [isAnimating, setIsAnimating] = useState(false);

  const selectLetter = (letter) => {
    if (letter === selectedLetter) return;
    setIsAnimating(true);
    setTimeout(() => {
      setSelectedLetter(letter);
      setIsAnimating(false);
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

            {/* lowercase */}
            <div className={styles.lowercaseRow}>
              <span className={styles.lowercaseLabel}>Chữ thường:</span>
              <span className={styles.lowercase}>
                {selectedLetter.toLowerCase()}
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
