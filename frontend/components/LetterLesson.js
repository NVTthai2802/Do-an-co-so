"use client";

import { useRouter } from "next/navigation";
import { getToken } from "../lib/auth";

const vietnameseAlphabet = [
  { letter: "A", word: "áo" },
  { letter: "Ă", word: "ăn" },
  { letter: "Â", word: "ấm" },
  { letter: "B", word: "bé" },
  { letter: "C", word: "cá" },
  { letter: "D", word: "dê" },
  { letter: "Đ", word: "đèn" },
  { letter: "E", word: "em" },
  { letter: "Ê", word: "ếch" },
  { letter: "G", word: "gà" },
  { letter: "H", word: "hoa" },
  { letter: "I", word: "in" },
  { letter: "K", word: "kem" },
  { letter: "L", word: "lá" },
  { letter: "M", word: "mẹ" },
  { letter: "N", word: "nai" },
  { letter: "O", word: "ong" },
  { letter: "Ô", word: "ô tô" },
  { letter: "Ơ", word: "ớt" },
  { letter: "P", word: "phở" },
  { letter: "Q", word: "quả" },
  { letter: "R", word: "rổ" },
  { letter: "S", word: "sao" },
  { letter: "T", word: "thỏ" },
  { letter: "U", word: "uống" },
  { letter: "Ư", word: "ươm" },
  { letter: "V", word: "vịt" },
  { letter: "X", word: "xe" },
  { letter: "Y", word: "y tá" },
];

const letterColors = ["#ff9f68", "#7c92ff", "#57c7a3", "#ff7a59", "#9b7cff", "#4ab5ff"];

const letterIllustrationIcons = {
  A: "👕",
  Ă: "🍚",
  Â: "🍲",
  B: "👶",
  C: "🐟",
  D: "🐐",
  Đ: "💡",
  E: "🧒",
  Ê: "🐸",
  G: "🐔",
  H: "🌸",
  I: "📄",
  K: "🍦",
  L: "🍃",
  M: "👩",
  N: "🦌",
  O: "🐝",
  Ô: "🚗",
  Ơ: "🌶️",
  P: "🍜",
  Q: "🍎",
  R: "🧺",
  S: "⭐",
  T: "🐰",
  U: "🥤",
  Ư: "🌱",
  V: "🦆",
  X: "🚲",
  Y: "🧑‍⚕️",
};

function createLetterIllustration(letter, word, emoji, color) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160" role="img" aria-label="Minh họa chữ ${letter}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#ffffff"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="240" height="160" rx="24" fill="url(#bg)"/>
      <circle cx="44" cy="44" r="28" fill="#ffffff"/>
      <text x="44" y="53" text-anchor="middle" font-size="28" font-weight="800" fill="${color}" font-family="Arial, sans-serif">${letter}</text>
      <text x="120" y="98" text-anchor="middle" font-size="62">${emoji}</text>
      <text x="120" y="142" text-anchor="middle" font-size="21" font-weight="700" fill="#2f2a2a" font-family="Arial, sans-serif">${word}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const letterOptions = vietnameseAlphabet.map((item, index) => ({
  ...item,
  color: letterColors[index % letterColors.length],
  illustration: createLetterIllustration(
    item.letter,
    item.word,
    letterIllustrationIcons[item.letter] || "📘",
    letterColors[index % letterColors.length]
  ),
}));

export default function LetterLesson({ selectedLetter, onSelectLetter }) {
  const router = useRouter();

  const goBack = () => router.back();

  return (
    <main className="dashboard-shell">
      <section className="dashboard-card">
        <div className="dashboard-header">
          <div>
            <span className="badge">Dạy chữ</span>
            <h1>Học 29 chữ cái tiếng Việt</h1>
            <p>Làm quen đầy đủ 29 chữ cái tiếng Việt và từ ví dụ đơn giản.</p>
          </div>
          <div className="dashboard-actions">
            <button className="btn secondary" onClick={goBack}>
              ← Quay lại
            </button>
          </div>
        </div>

        <section className="section-card" style={{ marginTop: "24px" }}>
          <div className="section-head">
            <div>
              <h2>Chọn chữ cái</h2>
              <p>Nhấn vào chữ để xem minh họa và ví dụ.</p>
            </div>
            <span className="badge">29 chữ cái</span>
          </div>

          <div className="chip-grid">
            {letterOptions.map((item) => (
              <button
                key={item.letter}
                className={`chip ${selectedLetter.letter === item.letter ? "active" : ""}`}
                onClick={() => onSelectLetter(item)}
              >
                {item.letter}
              </button>
            ))}
          </div>

          <div className="spotlight">
            <div className="big-letter" style={{ color: selectedLetter.color }}>
              {selectedLetter.letter}
            </div>
            <img
              className="letter-illustration"
              src={selectedLetter.illustration}
              alt={`Hình minh họa chữ ${selectedLetter.letter}: ${selectedLetter.word}`}
            />
            <p>
              {selectedLetter.letter} như <strong>{selectedLetter.word}</strong>.
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}
