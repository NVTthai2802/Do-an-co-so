"use client";

// Mục 6.2 – âm thanh tạo bằng Web Audio API, không cần file mp3.
let ctx;

const SOUND_KEY = "kl_sound";

export function soundEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(on) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    // Không lưu được thì thôi.
  }
}

function tone(freqs, step = 0.09, type = "triangle", vol = 0.18) {
  if (!soundEnabled()) return;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    return;
  }
  // Trình duyệt khoá AudioContext cho tới khi bé chạm lần đầu.
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  const t = ctx.currentTime;
  freqs.forEach((f, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t + i * step);
    g.gain.exponentialRampToValueAtTime(vol, t + i * step + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * step + step * 1.8);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t + i * step);
    o.stop(t + i * step + step * 2);
  });
}

export const sfx = {
  correct: () => tone([660, 880], 0.09),
  streak: () => tone([523, 659, 784, 1047], 0.08),
  finish: () => tone([523, 659, 784, 1047, 1319], 0.11, "triangle", 0.2),
  tryAgain: () => tone([330, 294], 0.12, "sine", 0.12),
  star: (i = 0) => tone([784 + i * 200], 0.1),
};

// Mục 6.1 – khen quá trình, không khen phẩm chất (Mueller & Dweck 1998).
export const PRAISE = [
  "Đúng rồi! Con đếm cẩn thận lắm!",
  "Giỏi quá! Con đã suy nghĩ rất kỹ!",
  "Chính xác! Con làm chăm chỉ quá!",
];

export const ENCOURAGE = [
  "Gần đúng rồi! Con thử lại nhé.",
  "Không sao đâu, mình thử lại nào!",
];

export function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}
