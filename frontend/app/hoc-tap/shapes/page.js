"use client";

import { useState } from "react";
import AirDrawActivity from "../../../components/AirDrawActivity";
import KidTopBar from "../../../components/KidTopBar";
import { speakVietnamese } from "../../../lib/speech";
import ShapeIcon from "../../../components/ShapeIcon";
import styles from "./HocHinh.module.css";

// Mục 5.6: mỗi hình chỉ còn id, tên và mô tả. Hình vẽ lấy từ bộ SVG chung
// trong components/ShapeIcon.js (cùng nét, cùng khung, tô màu của bài Hình),
// nên không còn mã màu riêng cho từng hình và không trộn emoji.
//
// group "hinh" = hình phẳng; group "net" = nét vẽ.
// "Đường thẳng" giữ lại (đã chốt ở Mục 8, câu 4) nhưng xếp riêng vào nhóm Nét.
const SHAPES = [
  {
    id: "tron",
    group: "hinh",
    name: "Hình Tròn",
    desc: "Không có cạnh, không có góc. Như mặt trăng, quả bóng!",
  },
  {
    id: "vuong",
    group: "hinh",
    name: "Hình Vuông",
    desc: "4 cạnh bằng nhau, 4 góc vuông. Như ô gạch, hộp quà!",
  },
  {
    id: "tamgiac",
    group: "hinh",
    name: "Hình Tam Giác",
    desc: "3 cạnh, 3 góc. Như núi, mái nhà, pizza!",
  },
  {
    id: "chunhat",
    group: "hinh",
    name: "Hình Chữ Nhật",
    desc: "4 cạnh, 2 cặp cạnh bằng nhau. Như cửa sổ, sách vở!",
  },
  {
    id: "thoi",
    group: "hinh",
    name: "Hình Thoi",
    desc: "4 cạnh bằng nhau nhưng góc không vuông. Như viên kim cương!",
  },
  {
    id: "luc",
    group: "hinh",
    name: "Hình Lục Giác",
    desc: "6 cạnh bằng nhau. Như tổ ong, sàn gỗ lục giác!",
  },
  {
    id: "sao",
    group: "hinh",
    name: "Hình Ngôi Sao",
    desc: "5 cánh nhọn. Như sao trên bầu trời đêm!",
  },
  {
    id: "trai_tim",
    group: "hinh",
    name: "Hình Trái Tim",
    desc: "Biểu tượng của tình yêu và sự quan tâm!",
  },
  {
    id: "duong_thang",
    group: "net",
    name: "Đường Thẳng",
    desc: "Một nét đi thẳng từ điểm này đến điểm kia. Như thước kẻ, con đường!",
  },
];

const SHAPE_GROUPS = [
  { id: "hinh", label: "Hình", items: SHAPES.filter((s) => s.group === "hinh") },
  { id: "net", label: "Nét", items: SHAPES.filter((s) => s.group === "net") },
];

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

// Đường thẳng dễ nhất nên đặt đầu tiên, làm bài khởi động cho vẽ trên không
// (Mục 5.6).
const CAMERA_SHAPE_IDS = ["duong_thang", "tron", "vuong", "tamgiac", "luc", "sao"];

const CAMERA_SHAPES = CAMERA_SHAPE_IDS.map((id) => SHAPES.find((shape) => shape.id === id)).map((shape) => ({
  id: shape.id,
  label: shape.name,
  speech: shape.name.toLowerCase(),
  preview: <ShapeIcon id={shape.id} size={120} />,
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
    <main className="kid-shell">
      <KidTopBar subject="shp" title="Hình" />
      <div className="kid-lesson subject-shp">

        <div className={styles.lessonContent}>

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
          {SHAPE_GROUPS.map((group) => (
            <div key={group.id} className={styles.shapeGroup}>
              <h3 className={styles.shapeGroupLabel}>{group.label}</h3>
              <div className={styles.shapeGrid}>
                {group.items.map((shape) => (
                  <button
                    key={shape.id}
                    type="button"
                    className={`${styles.shapeBtn} ${
                      selectedShape.id === shape.id ? styles.shapeBtnActive : ""
                    }`}
                    onClick={() => selectShape(shape)}
                    aria-pressed={selectedShape.id === shape.id}
                  >
                    <ShapeIcon id={shape.id} size={56} />
                    <span className={styles.shapeBtnName}>
                      {shape.name.replace("Hình ", "")}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Detail card */}
          <div className={`${styles.card} ${isAnimating ? styles.cardFade : ""}`}>
            <div className={styles.svgArea}>
              <ShapeIcon id={selectedShape.id} size={160} title={selectedShape.name} />
            </div>
            <div className={styles.shapeName}>{selectedShape.name}</div>
            <div className={styles.shapeDesc}>{selectedShape.desc}</div>
            <button
              type="button"
              className="kbtn subject-shp"
              onClick={() => speakShape(selectedShape)}
            >
              🔊 Nghe
            </button>
          </div>
        </div>
      )}

      {/* ===== TAB CAMERA ===== */}
      {activeTab === "camera" && (
        <AirDrawActivity
          activityLabel="hình"
          endpoint="/api/recognize-shape"
          items={CAMERA_SHAPES}
          learningModuleKey="geometry"
        />
      )}
        </div>
      </div>
    </main>
  );
}
