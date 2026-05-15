"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clearSession, getToken, saveSession } from "../lib/auth";
import { request } from "../lib/api";

const numberOptions = Array.from({ length: 10 }, (_, index) => index + 1);
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
const shapeOptions = [
  { name: "Hình tròn", key: "circle", text: "Mềm mại, không có góc." },
  { name: "Hình vuông", key: "square", text: "4 cạnh bằng nhau." },
  { name: "Hình tam giác", key: "triangle", text: "Có 3 cạnh." },
  { name: "Hình chữ nhật", key: "rectangle", text: "Dài hơn vuông." },
];

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [selectedNumber, setSelectedNumber] = useState(1);
  const [selectedLetter, setSelectedLetter] = useState(letterOptions[0]);
  const [selectedShape, setSelectedShape] = useState(shapeOptions[0]);
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
      // Ignore logout API errors and clear the local session anyway.
    } finally {
      clearSession();
      router.replace("/login");
    }
  }

  if (loading) {
    return (
      <main className="dashboard-shell">
        <section className="dashboard-card">Đang mở lớp học vui nhộn...</section>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <section className="dashboard-card">
        <div className="dashboard-header">
          <div>
            <span className="badge">Lớp học của bé</span>
            <h1>Xin chào, {user?.name || "bé"}!</h1>
            <p>Chọn bài học số, chữ hoặc hình để bắt đầu khám phá.</p>
          </div>
          <div className="dashboard-actions">
            <button className="btn secondary" onClick={handleLogout}>
              Đăng xuất
            </button>
          </div>
        </div>

        <div className="section-list">
          <section className="section-card">
            <div className="section-head">
              <div>
                <h2>Dạy số</h2>
                <p>Chạm vào một con số để xem cách đếm đồ vật tương ứng.</p>
              </div>
              <span className="badge">1 - 10</span>
            </div>

            <div className="chip-grid">
              {numberOptions.map((number) => (
                <button
                  key={number}
                  className={`chip ${selectedNumber === number ? "active" : ""}`}
                  onClick={() => setSelectedNumber(number)}
                >
                  {number}
                </button>
              ))}
            </div>

            <div className="spotlight">
              <div className="big-number">{selectedNumber}</div>
              <p>
                Bé đang học số <strong>{selectedNumber}</strong> với{" "}
                {selectedNumber} quả táo minh họa.
              </p>
              <div aria-label="đồ vật minh hoạ">
                {Array.from({ length: selectedNumber }, (_, index) => (
                  <span key={index}>🍎</span>
                ))}
              </div>
            </div>
          </section>

          <section className="section-card">
            <div className="section-head">
              <div>
                <h2>Dạy chữ</h2>
                <p>Làm quen đầy đủ 29 chữ cái tiếng Việt và từ ví dụ đơn giản.</p>
              </div>
              <span className="badge">29 chữ cái</span>
            </div>

            <div className="chip-grid">
              {letterOptions.map((item) => (
                <button
                  key={item.letter}
                  className={`chip ${selectedLetter.letter === item.letter ? "active" : ""}`}
                  onClick={() => setSelectedLetter(item)}
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

          <section className="section-card">
            <div className="section-head">
              <div>
                <h2>Dạy nhận dạng hình vẽ</h2>
                <p>Nhận biết hình cơ bản qua màu sắc và mô tả dễ nhớ.</p>
              </div>
              <span className="badge">Hình cơ bản</span>
            </div>

            <div className="chip-grid">
              {shapeOptions.map((shape) => (
                <button
                  key={shape.key}
                  className={`chip ${selectedShape.key === shape.key ? "active" : ""}`}
                  onClick={() => setSelectedShape(shape)}
                >
                  {shape.name}
                </button>
              ))}
            </div>

            <div className="spotlight">
              <div className={`shape-preview ${selectedShape.key}`} />
              <p>
                <strong>{selectedShape.name}</strong> - {selectedShape.text}
              </p>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

