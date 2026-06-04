"use client";

import Link from "next/link";
import { useState } from "react";
import AirDrawActivity from "../../../components/AirDrawActivity";
import LessonNav from "../../../components/LessonNav";
import { speakVietnamese } from "../../../lib/speech";
import styles from "./HocHinh.module.css";

const SHAPES = [
  {
    id: "tron",
    name: "Hình Tròn",
    emoji: "⭕",
    color: "#ef4444",
    desc: "Không có cạnh, không có góc. Như mặt trăng, quả bóng!",
    svg: (
      <svg viewBox="0 0 100 100" width="120" height="120">
        <circle cx="50" cy="50" r="42" fill="none" stroke="#ef4444" strokeWidth="6" />
      </svg>
    ),
  },
  {
    id: "vuong",
    name: "Hình Vuông",
    emoji: "🟥",
    color: "#3b82f6",
    desc: "4 cạnh bằng nhau, 4 góc vuông. Như ô gạch, hộp quà!",
    svg: (
      <svg viewBox="0 0 100 100" width="120" height="120">
        <rect x="14" y="14" width="72" height="72" fill="none" stroke="#3b82f6" strokeWidth="6" />
      </svg>
    ),
  },
  {
    id: "tamgiac",
    name: "Hình Tam Giác",
    emoji: "🔺",
    color: "#f59e0b",
    desc: "3 cạnh, 3 góc. Như núi, mái nhà, pizza!",
    svg: (
      <svg viewBox="0 0 100 100" width="120" height="120">
        <polygon points="50,10 92,88 8,88" fill="none" stroke="#f59e0b" strokeWidth="6" />
      </svg>
    ),
  },
  {
    id: "chunhat",
    name: "Hình Chữ Nhật",
    emoji: "▬",
    color: "#10b981",
    desc: "4 cạnh, 2 cặp cạnh bằng nhau. Như cửa sổ, sách vở!",
    svg: (
      <svg viewBox="0 0 100 100" width="120" height="120">
        <rect x="8" y="26" width="84" height="48" fill="none" stroke="#10b981" strokeWidth="6" />
      </svg>
    ),
  },
  {
    id: "duong_thang",
    name: "Đường Thẳng",
    emoji: "━",
    color: "#0ea5e9",
    desc: "Một nét đi thẳng từ điểm này đến điểm kia. Như thước kẻ, con đường!",
    svg: (
      <svg viewBox="0 0 100 100" width="120" height="120">
        <line x1="14" y1="50" x2="86" y2="50" stroke="#0ea5e9" strokeWidth="8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "thayap",
    name: "Hình Thoi",
    emoji: "🔷",
    color: "#8b5cf6",
    desc: "4 cạnh bằng nhau nhưng góc không vuông. Như viên kim cương!",
    svg: (
      <svg viewBox="0 0 100 100" width="120" height="120">
        <polygon points="50,8 90,50 50,92 10,50" fill="none" stroke="#8b5cf6" strokeWidth="6" />
      </svg>
    ),
  },
  {
    id: "luc",
    name: "Hình Lục Giác",
    emoji: "⬡",
    color: "#ec4899",
    desc: "6 cạnh bằng nhau. Như tổ ong, sàn gỗ lục giác!",
    svg: (
      <svg viewBox="0 0 100 100" width="120" height="120">
        <polygon
          points="50,6 90,28 90,72 50,94 10,72 10,28"
          fill="none"
          stroke="#ec4899"
          strokeWidth="6"
        />
      </svg>
    ),
  },
  {
    id: "sao",
    name: "Hình Ngôi Sao",
    emoji: "⭐",
    color: "#f97316",
    desc: "5 cánh nhọn. Như sao trên bầu trời đêm!",
    svg: (
      <svg viewBox="0 0 100 100" width="120" height="120">
        <polygon
          points="50,6 61,38 96,38 68,58 79,90 50,70 21,90 32,58 4,38 39,38"
          fill="none"
          stroke="#f97316"
          strokeWidth="5"
        />
      </svg>
    ),
  },
  {
    id: "trai_tim",
    name: "Hình Trái Tim",
    emoji: "❤️",
    color: "#e11d48",
    desc: "Biểu tượng của tình yêu và sự quan tâm!",
    svg: (
      <svg viewBox="0 0 100 100" width="120" height="120">
        <path
          d="M50 85 C50 85 10 58 10 35 C10 20 22 10 35 14 C42 16 50 24 50 24 C50 24 58 16 65 14 C78 10 90 20 90 35 C90 58 50 85 50 85Z"
          fill="none"
          stroke="#e11d48"
          strokeWidth="5"
        />
      </svg>
    ),
  },
];

function setupTemplateStroke(ctx, width) {
  ctx.strokeStyle = "#fff";
  ctx.fillStyle = "#fff";
  ctx.lineWidth = Math.max(8, width * 0.08);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

function drawStarPath(ctx, width, height) {
  const cx = width / 2;
  const cy = height / 2;
  const outer = Math.min(width, height) * 0.34;
  const inner = outer * 0.45;
  ctx.beginPath();
  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
}

function drawShapeTemplate(id) {
  return (ctx, width, height) => {
    setupTemplateStroke(ctx, width);
    const cx = width / 2;
    const cy = height / 2;
    const size = Math.min(width, height);

    if (id === "tron") {
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.32, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }

    if (id === "vuong") {
      const side = size * 0.56;
      ctx.strokeRect(cx - side / 2, cy - side / 2, side, side);
      return;
    }

    if (id === "tamgiac") {
      ctx.beginPath();
      ctx.moveTo(cx, cy - size * 0.34);
      ctx.lineTo(cx + size * 0.36, cy + size * 0.32);
      ctx.lineTo(cx - size * 0.36, cy + size * 0.32);
      ctx.closePath();
      ctx.stroke();
      return;
    }

    if (id === "sao") {
      drawStarPath(ctx, width, height);
      return;
    }

    if (id === "duong_thang") {
      ctx.beginPath();
      ctx.moveTo(width * 0.18, cy);
      ctx.lineTo(width * 0.82, cy);
      ctx.stroke();
      return;
    }

    if (id === "luc") {
      ctx.beginPath();
      for (let index = 0; index < 6; index += 1) {
        const angle = -Math.PI / 2 + (index * Math.PI) / 3;
        const x = cx + Math.cos(angle) * size * 0.36;
        const y = cy + Math.sin(angle) * size * 0.36;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  };
}

const CAMERA_SHAPE_IDS = ["tron", "vuong", "tamgiac", "sao", "duong_thang", "luc"];

const CAMERA_SHAPES = SHAPES.filter((shape) => CAMERA_SHAPE_IDS.includes(shape.id)).map((shape) => ({
  id: shape.id,
  label: shape.name,
  speech: shape.name.toLowerCase(),
  color: shape.color,
  preview: shape.svg,
  aliases: [
    shape.name,
    shape.name.replace("Hình ", ""),
    shape.id,
    shape.id === "tron" ? "hinh tron circle" : "",
    shape.id === "vuong" ? "hinh vuong square" : "",
    shape.id === "tamgiac" ? "hinh tam giac triangle" : "",
    shape.id === "sao" ? "ngoi sao star" : "",
    shape.id === "duong_thang" ? "duong thang line" : "",
    shape.id === "luc" ? "luc giac hexagon" : "",
  ],
  drawTemplate: drawShapeTemplate(shape.id),
}));

export default function HocHinh() {
  const [activeTab, setActiveTab] = useState("hoc");
  const [selectedShape, setSelectedShape] = useState(SHAPES[0]);
  const [isAnimating, setIsAnimating] = useState(false);

  const speakShape = (shape) => {
    speakVietnamese(shape.name.toLowerCase());
  };

  const selectShape = (shape) => {
    if (shape.id === selectedShape.id) {
      speakShape(shape);
      return;
    }
    setIsAnimating(true);
    setTimeout(() => {
      setSelectedShape(shape);
      setIsAnimating(false);
      speakShape(shape);
    }, 200);
  };

  return (
    <main className="dashboard-shell">
      <section className="dashboard-card">
        <div className="dashboard-header">
          <div>
            <span className="badge">Dạy hình</span>
            <h1>Học Hình Dạng</h1>
          </div>
          <div className="dashboard-actions">
            <LessonNav />
            <Link href="/dashboard" className="btn secondary">
              Quay lại
            </Link>
          </div>
        </div>

        <div className={styles.lessonContent}>
      <h1 className={styles.title}>🔷 Học Hình Dạng</h1>

      {/* Tab bar */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${activeTab === "hoc" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("hoc")}
        >
          📐 Học Hình
        </button>
        <button
          className={`${styles.tab} ${activeTab === "camera" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("camera")}
        >
          📷 Nhận Dạng
        </button>
      </div>

      {/* ===== TAB HỌC HÌNH ===== */}
      {activeTab === "hoc" && (
        <div className={styles.learnSection}>
          {/* Shape grid */}
          <div className={styles.shapeGrid}>
            {SHAPES.map((shape) => (
              <button
                key={shape.id}
                className={`${styles.shapeBtn} ${
                  selectedShape.id === shape.id ? styles.shapeBtnActive : ""
                }`}
                onClick={() => selectShape(shape)}
                style={{
                  "--shape-color": shape.color,
                  borderColor:
                    selectedShape.id === shape.id ? shape.color : undefined,
                }}
              >
                <span className={styles.shapeEmoji}>{shape.emoji}</span>
                <span className={styles.shapeBtnName}>{shape.name.replace("Hình ", "")}</span>
              </button>
            ))}
          </div>

          {/* Detail card */}
          <div
            className={`${styles.card} ${isAnimating ? styles.cardFade : ""}`}
            style={{ "--shape-color": selectedShape.color }}
          >
            <div className={styles.svgArea}>{selectedShape.svg}</div>
            <div className={styles.shapeName}>{selectedShape.name}</div>
            <div className={styles.shapeDesc}>{selectedShape.desc}</div>
            <button className="btn primary compact" onClick={() => speakShape(selectedShape)}>
              Nghe phát âm
            </button>

            <div className={styles.emojiRow}>
              <span className={styles.shapeEmojiLarge}>{selectedShape.emoji}</span>
            </div>
          </div>
        </div>
      )}

      {/* ===== TAB CAMERA ===== */}
      {activeTab === "camera" && (
        <AirDrawActivity
          activityLabel="hình"
          endpoint="/api/recognize-shape"
          items={CAMERA_SHAPES}
        />
      )}
        </div>
      </section>
    </main>
  );
}
