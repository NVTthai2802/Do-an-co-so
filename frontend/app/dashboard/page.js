"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { clearSession, getToken, saveSession } from "../../lib/auth";
import { request } from "../../lib/api";

const VIETNAMESE_NUMBERS = [
  "Không", "Một", "Hai", "Ba", "Bốn", "Năm", "Sáu", "Bảy", "Tám", "Chín",
  "Mười", "Mười một", "Mười hai", "Mười ba", "Mười bốn", "Mười năm", "Mười sáu", "Mười bảy", "Mười tám", "Mười chín",
  "Hai mươi", "Hai mươi một", "Hai mươi hai", "Hai mươi ba", "Hai mươi bốn", "Hai mươi năm", "Hai mươi sáu", "Hai mươi bảy", "Hai mươi tám", "Hai mươi chín",
  "Ba mươi", "Ba mươi một", "Ba mươi hai", "Ba mươi ba", "Ba mươi bốn", "Ba mươi năm", "Ba mươi sáu", "Ba mươi bảy", "Ba mươi tám", "Ba mươi chín",
  "Bốn mươi", "Bốn mươi một", "Bốn mươi hai", "Bốn mươi ba", "Bốn mươi bốn", "Bốn mươi năm", "Bốn mươi sáu", "Bốn mươi bảy", "Bốn mươi tám", "Bốn mươi chín",
  "Năm mươi", "Năm mươi một", "Năm mươi hai", "Năm mươi ba", "Năm mươi bốn", "Năm mươi năm", "Năm mươi sáu", "Năm mươi bảy", "Năm mươi tám", "Năm mươi chín",
  "Sáu mươi", "Sáu mươi một", "Sáu mươi hai", "Sáu mươi ba", "Sáu mươi bốn", "Sáu mươi năm", "Sáu mươi sáu", "Sáu mươi bảy", "Sáu mươi tám", "Sáu mươi chín",
  "Bảy mươi", "Bảy mươi một", "Bảy mươi hai", "Bảy mươi ba", "Bảy mươi bốn", "Bảy mươi năm", "Bảy mươi sáu", "Bảy mươi bảy", "Bảy mươi tám", "Bảy mươi chín",
  "Tám mươi", "Tám mươi một", "Tám mươi hai", "Tám mươi ba", "Tám mươi bốn", "Tám mươi năm", "Tám mươi sáu", "Tám mươi bảy", "Tám mươi tám", "Tám mươi chín",
  "Chín mươi", "Chín mươi một", "Chín mươi hai", "Chín mươi ba", "Chín mươi bốn", "Chín mươi năm", "Chín mươi sáu", "Chín mươi bảy", "Chín mươi tám", "Chín mươi chín",
  "Một trăm"
];

const getNumberRepresentation = (num) => {
  if (num <= 20) {
    return "●".repeat(num);
  }
  const grid_size = 5;
  const rows = Math.ceil(num / grid_size);
  const cols = Math.min(num, grid_size);
  return `${rows}×${cols}`;
};

const LESSONS = {
  numbers: {
    title: "Dạy số",
    subtitle: "Học đếm từ 1 đến 100",
    description: "Nhấn vào mỗi số để nghe cách phát âm.",
    icon: "📊",
    items: Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      label: `Số ${i + 1}`,
      vietnamese: VIETNAMESE_NUMBERS[i + 1],
      content: i + 1,
      representation: getNumberRepresentation(i + 1),
    })),
  },
  letters: {
    title: "Dạy chữ",
    subtitle: "Học bảng chữ cái tiếng Việt",
    description: "Nhấn vào mỗi chữ để nghe cách phát âm.",
    icon: "🔤",
    items: [
      { id: "a", label: "Chữ A", content: "A", name: "Áo", illustration: "👕" },
      { id: "a2", label: "Chữ Ă", content: "Ă", name: "Rắn", illustration: "🐍" },
      { id: "a3", label: "Chữ Â", content: "Â", name: "Ấm", illustration: "🫖" },
      { id: "b", label: "Chữ B", content: "B", name: "Bóng", illustration: "⚽" },
      { id: "c", label: "Chữ C", content: "C", name: "Chó", illustration: "🐕" },
      { id: "d", label: "Chữ D", content: "D", name: "Dưa", illustration: "🍉" },
      { id: "dd", label: "Chữ Đ", content: "Đ", name: "Đèn", illustration: "💡" },
      { id: "e", label: "Chữ E", content: "E", name: "Em bé", illustration: "👧" },
      { id: "e2", label: "Chữ Ê", content: "Ê", name: "Ếch", illustration: "🐸" },
      { id: "g", label: "Chữ G", content: "G", name: "Gà", illustration: "🐔" },
      { id: "h", label: "Chữ H", content: "H", name: "Hà mã", illustration: "🦛" },
      { id: "i", label: "Chữ I", content: "I", name: "Tivi", illustration: "📺" },
      { id: "k", label: "Chữ K", content: "K", name: "Khoai", illustration: "🥔" },
      { id: "l", label: "Chữ L", content: "L", name: "Lá", illustration: "🍃" },
      { id: "m", label: "Chữ M", content: "M", name: "Mẹ", illustration: "👩" },
      { id: "n", label: "Chữ N", content: "N", name: "Nước", illustration: "💧" },
      { id: "o", label: "Chữ O", content: "O", name: "Con ong", illustration: "🐝" },
      { id: "p", label: "Chữ P", content: "P", name: "Phương hướng", illustration: "🧭" },
      { id: "q", label: "Chữ Q", content: "Q", name: "Quốc", illustration: "👑" },
      { id: "r", label: "Chữ R", content: "R", name: "Rau", illustration: "🥬" },
      { id: "s", label: "Chữ S", content: "S", name: "Sao", illustration: "⭐" },
      { id: "t", label: "Chữ T", content: "T", name: "Tàu", illustration: "🚂" },
      { id: "u", label: "Chữ U", content: "U", name: "Ưu tiên", illustration: "☂️" },
      { id: "u2", label: "Chữ Ư", content: "Ư", name: "Lược", illustration: "🪮" },
      { id: "v", label: "Chữ V", content: "V", name: "Voi", illustration: "🐘" },
      { id: "x", label: "Chữ X", content: "X", name: "Xoài", illustration: "🥭" },
      { id: "y", label: "Chữ Y", content: "Y", name: "Yêu thương", illustration: "💕" },
      { id: "z", label: "Chữ Z", content: "Z", name: "Zigzag", illustration: "⚡" },
    ],
  },
  shapes: {
    title: "Dạy hình",
    subtitle: "Nhận dạng hình cơ bản",
    description: "Nhấn vào mỗi hình để xem ví dụ.",
    icon: "🎨",
    items: [
      { id: "circle", label: "Hình tròn", content: "●", name: "Hình tròn" },
      { id: "square", label: "Hình vuông", content: "■", name: "Hình vuông" },
      { id: "triangle", label: "Hình tam giác", content: "▲", name: "Hình tam giác" },
      { id: "rectangle", label: "Hình chữ nhật", content: "▬", name: "Hình chữ nhật" },
      { id: "diamond", label: "Hình thoi", content: "◆", name: "Hình thoi" },
      { id: "star", label: "Hình sao", content: "★", name: "Hình sao" },
      { id: "heart", label: "Hình trái tim", content: "❤", name: "Hình trái tim" },
    ],
  },
  colors: {
    title: "Dạy màu",
    subtitle: "Học các màu sắc",
    description: "Nhấn vào mỗi màu để nghe cách phát âm.",
    icon: "🎨",
    items: [
      { id: "red", label: "Màu đỏ", content: "🔴", name: "Đỏ", illustration: "🔴" },
      { id: "orange", label: "Màu cam", content: "🟠", name: "Cam", illustration: "🟠" },
      { id: "yellow", label: "Màu vàng", content: "🟡", name: "Vàng", illustration: "🟡" },
      { id: "green", label: "Màu xanh lá", content: "🟢", name: "Xanh lá", illustration: "🟢" },
      { id: "blue", label: "Màu xanh da trời", content: "🔵", name: "Xanh da trời", illustration: "🔵" },
      { id: "purple", label: "Màu tím", content: "🟣", name: "Tím", illustration: "🟣" },
      { id: "pink", label: "Màu hồng", content: "🩷", name: "Hồng", illustration: "🩷" },
      { id: "brown", label: "Màu nâu", content: "🟤", name: "Nâu", illustration: "🟤" },
      { id: "white", label: "Màu trắng", content: "⚪", name: "Trắng", illustration: "⚪" },
    ],
  },
};

export default function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lessonType = searchParams.get("lesson");
  const [user, setUser] = useState(null);
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

  // Show lesson if lesson param is present
  if (lessonType && LESSONS[lessonType]) {
    const lesson = LESSONS[lessonType];
    return (
      <main className="dashboard-shell">
        <section className="dashboard-card">
          <div className="dashboard-header">
            <div>
              <span className="badge">{lesson.title}</span>
              <h1>{lesson.subtitle}</h1>
              <p>{lesson.description}</p>
            </div>
            <div className="dashboard-actions">
              <Link href="/dashboard" className="btn secondary">
                Quay lại
              </Link>
            </div>
          </div>

          <div className="lesson-grid" style={{ marginTop: "28px" }}>
            {lesson.items.map((item) => (
              <div
                key={item.id}
                className="lesson-card"
              >
                {item.illustration && (
                  <div style={{ fontSize: "80px", marginBottom: "12px" }}>
                    {item.illustration}
                  </div>
                )}
                <div style={{ fontSize: item.illustration ? "48px" : "120px", fontWeight: "bold", marginBottom: item.illustration ? "8px" : "24px" }}>
                  {item.content}
                </div>
                <h2>{item.name || item.vietnamese}</h2>
              </div>
            ))}
          </div>
        </section>
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
            <p>Chọn một bài học để bắt đầu khám phá.</p>
          </div>
          <div className="dashboard-actions">
            <button className="btn secondary" onClick={handleLogout}>
              Đăng xuất
            </button>
          </div>
        </div>

        <div className="lesson-grid" style={{ marginTop: "28px" }}>
          <Link href="/dashboard?lesson=numbers" className="lesson-card">
            <div className="lesson-icon">📊</div>
            <h2>Dạy số</h2>
            <p>Học đếm từ 1 đến 10 với minh họa trực quan.</p>
            <div className="lesson-cta">Vào học →</div>
          </Link>

          <Link href="/dashboard?lesson=letters" className="lesson-card">
            <div className="lesson-icon">🔤</div>
            <h2>Dạy chữ</h2>
            <p>Học 29 chữ cái tiếng Việt với ví dụ dễ hiểu.</p>
            <div className="lesson-cta">Vào học →</div>
          </Link>

          <Link href="/dashboard?lesson=shapes" className="lesson-card">
            <div className="lesson-icon">🎨</div>
            <h2>Dạy hình</h2>
            <p>Nhận dạng hình cơ bản qua màu sắc và mô tả.</p>
            <div className="lesson-cta">Vào học →</div>
          </Link>
        </div>
      </section>
    </main>
  );
}

// 2. TẠO COMPONENT MỚI ĐỂ BỌC SUSPENSE (ĐÂY LÀ CHÌA KHÓA FIX LỖI)
export default function DashboardPage() {
  return (
    <Suspense fallback={
      <main className="dashboard-shell">
        <section className="dashboard-card">Đang tải dữ liệu...</section>
      </main>
    }>
      <DashboardContent />
    </Suspense>
  );
}