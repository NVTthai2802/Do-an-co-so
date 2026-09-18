"use client";

// Kho bài đọc mẫu cho "Bé luyện đọc" (Mục 5.2).
// Phụ huynh chọn một đoạn ở /dashboard/tools, đoạn đó thành "bài đọc hôm nay".
// Đoạn ngắn 1–3 câu, từ ngữ quen thuộc với bé 3–6 tuổi.

export const READING_PASSAGES = [
  { id: "meo-con", title: "Mèo con", text: "Mèo con nằm ngủ bên cửa sổ. Nắng ấm chiếu lên bộ lông vàng." },
  { id: "vuon-nha", title: "Vườn nhà", text: "Trong vườn có cây cam và cây ổi. Bé tưới nước cho cây mỗi sáng." },
  { id: "di-hoc", title: "Bé đi học", text: "Sáng nay bé dậy sớm. Bé đeo cặp và chào mẹ rồi đi học." },
  { id: "con-ca", title: "Con cá vàng", text: "Con cá vàng bơi trong bể nước. Cá vẫy đuôi thật nhanh." },
  { id: "troi-mua", title: "Trời mưa", text: "Trời đổ mưa rào. Bé đứng trong nhà nhìn mưa rơi trên mái." },
  { id: "ba-noi", title: "Bà nội", text: "Bà nội kể chuyện cho bé nghe. Giọng bà ấm và chậm rãi." },
  { id: "chu-cho", title: "Chú chó nhỏ", text: "Chú chó nhỏ chạy ra đón bé. Đuôi chú ngoe nguẩy mừng rỡ." },
  { id: "bua-com", title: "Bữa cơm", text: "Cả nhà ngồi quanh mâm cơm. Bé mời ông bà và bố mẹ ăn cơm." },
  { id: "buoi-toi", title: "Buổi tối", text: "Buổi tối bé đánh răng rồi lên giường. Mẹ tắt đèn và chúc bé ngủ ngon." },
  { id: "cau-vong", title: "Cầu vồng", text: "Mưa tạnh rồi, cầu vồng hiện ra trên bầu trời. Cầu vồng có bảy màu rất đẹp." },
];

const STORAGE_KEY = "kl_reading_today";

export function getTodayPassage() {
  const fallback = READING_PASSAGES[0];
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw);
    if (saved && typeof saved.text === "string" && saved.text.trim()) {
      return { id: saved.id || "custom", title: saved.title || "Bài đọc hôm nay", text: saved.text };
    }
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
  }

  return fallback;
}

export function setTodayPassage({ id, title, text }) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ id: id || "custom", title: title || "Bài đọc hôm nay", text })
  );
}

export function clearTodayPassage() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
