"use client";

import confetti from "canvas-confetti";

// Mục 6.2 / 6.3 – hiệu ứng chúc mừng. Chỉ dùng màu trong bảng màu Mục 4.1.
const KID_COLORS = ["#FF9F1C", "#4D96FF", "#22C55E", "#A97BFF", "#FF5C9A", "#FFC21A"];
const base = { colors: KID_COLORS, disableForReducedMotion: true, zIndex: 70 };

const EFFECTS_KEY = "kl_effects";

/**
 * Có được bắn pháo không? Hai cửa: cài đặt hệ điều hành ("giảm chuyển động")
 * và công tắc của phụ huynh. Tắt hiệu ứng KHÔNG tắt âm thanh (Mục 6.1).
 */
export function motionAllowed() {
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem(EFFECTS_KEY) === "off") return false;
  } catch {
    // Trình duyệt chặn localStorage: vẫn theo cài đặt hệ điều hành.
  }
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function effectsEnabled() {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(EFFECTS_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setEffectsEnabled(on) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EFFECTS_KEY, on ? "on" : "off");
  } catch {
    // Không lưu được thì thôi, không làm hỏng lượt chơi.
  }
}

function originOf(el) {
  if (!el) return { x: 0.5, y: 0.6 };
  const r = el.getBoundingClientRect();
  return {
    x: (r.left + r.width / 2) / window.innerWidth,
    y: (r.top + r.height / 2) / window.innerHeight,
  };
}

/** Cấp 1: pháo giấy nhỏ bắn ra từ chính nút vừa bấm. */
export function celebrateCorrect(buttonEl) {
  if (!motionAllowed()) return;
  confetti({
    ...base,
    particleCount: 40,
    spread: 70,
    startVelocity: 32,
    scalar: 0.9,
    ticks: 120,
    origin: originOf(buttonEl),
  });
}

/** Cấp 2: pháo giấy từ hai bên màn hình, khoảng 0,9 giây. */
export function celebrateStreak() {
  if (!motionAllowed()) return;
  const end = Date.now() + 900;
  (function frame() {
    confetti({ ...base, particleCount: 6, angle: 60, spread: 55, origin: { x: 0, y: 0.75 } });
    confetti({ ...base, particleCount: 6, angle: 120, spread: 55, origin: { x: 1, y: 0.75 } });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

/** Cấp 3: pháo hoa khi xong lượt chơi. Trả về hàm dừng sớm. */
export function celebrateFinish() {
  if (!motionAllowed()) return () => {};
  const star = confetti.shapeFromText ? confetti.shapeFromText({ text: "⭐", scalar: 2 }) : null;
  const end = Date.now() + 2200;
  let n = 0;
  const id = setInterval(() => {
    if (Date.now() > end) {
      clearInterval(id);
      return;
    }
    confetti({
      ...base,
      particleCount: 45,
      startVelocity: 28,
      spread: 360,
      ticks: 70,
      gravity: 0.9,
      origin: { x: 0.15 + Math.random() * 0.7, y: 0.15 + Math.random() * 0.3 },
    });
    if (star && n++ % 2 === 0) {
      confetti({
        ...base,
        particleCount: 8,
        spread: 120,
        startVelocity: 22,
        scalar: 2,
        shapes: [star],
        origin: { x: 0.5, y: 0.35 },
      });
    }
  }, 320);

  return () => {
    clearInterval(id);
    confetti.reset();
  };
}

/**
 * Ngôi sao bay từ nút vừa bấm vào ô đếm sao trên thanh trên cùng
 * (cách làm lấy theo hàm flyStar trong file demo).
 * Khi bé tắt hiệu ứng thì bỏ qua, ô sao vẫn tăng số như thường.
 */
export function flyStar(fromEl, toEl) {
  if (!motionAllowed() || !fromEl || !toEl || typeof document === "undefined") return;

  const from = fromEl.getBoundingClientRect();
  const to = toEl.getBoundingClientRect();

  const star = document.createElement("span");
  star.className = "fly-star";
  star.textContent = "⭐";
  star.setAttribute("aria-hidden", "true");
  star.style.left = `${from.left + from.width / 2 - 17}px`;
  star.style.top = `${from.top + from.height / 2 - 17}px`;
  document.body.appendChild(star);

  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      star.style.transform = `translate(${dx}px, ${dy}px) scale(.6)`;
      star.style.opacity = "1";
    });
  });

  setTimeout(() => star.remove(), 750);
}
