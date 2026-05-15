"use client";

import { useRouter } from "next/navigation";
import { getToken } from "../lib/auth";

const shapeOptions = [
  { name: "Hình tròn", key: "circle", text: "Mềm mại, không có góc." },
  { name: "Hình vuông", key: "square", text: "4 cạnh bằng nhau." },
  { name: "Hình tam giác", key: "triangle", text: "Có 3 cạnh." },
  { name: "Hình chữ nhật", key: "rectangle", text: "Dài hơn vuông." },
];

export default function ShapeLesson({ selectedShape, onSelectShape }) {
  const router = useRouter();

  const goBack = () => router.back();

  return (
    <main className="dashboard-shell">
      <section className="dashboard-card">
        <div className="dashboard-header">
          <div>
            <span className="badge">Dạy hình</span>
            <h1>Nhận dạng hình vẽ cơ bản</h1>
            <p>Nhận biết hình cơ bản qua màu sắc và mô tả dễ nhớ.</p>
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
              <h2>Chọn hình</h2>
              <p>Nhấn vào hình để xem minh họa.</p>
            </div>
            <span className="badge">Hình cơ bản</span>
          </div>

          <div className="chip-grid">
            {shapeOptions.map((shape) => (
              <button
                key={shape.key}
                className={`chip ${selectedShape.key === shape.key ? "active" : ""}`}
                onClick={() => onSelectShape(shape)}
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
      </section>
    </main>
  );
}
