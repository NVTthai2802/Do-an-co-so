"use client";

import { useRouter } from "next/navigation";
import { getToken } from "../lib/auth";

const numberOptions = Array.from({ length: 10 }, (_, index) => index + 1);

export default function NumberLesson({ selectedNumber, onSelectNumber }) {
  const router = useRouter();

  const goBack = () => router.back();

  return (
    <main className="dashboard-shell">
      <section className="dashboard-card">
        <div className="dashboard-header">
          <div>
            <span className="badge">Dạy số</span>
            <h1>Học số từ 1 đến 10</h1>
            <p>Chạm vào một con số để xem cách đếm đồ vật tương ứng.</p>
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
              <h2>Chọn con số</h2>
              <p>Nhấn vào số để xem minh họa.</p>
            </div>
            <span className="badge">1 - 10</span>
          </div>

          <div className="chip-grid">
            {numberOptions.map((number) => (
              <button
                key={number}
                className={`chip ${selectedNumber === number ? "active" : ""}`}
                onClick={() => onSelectNumber(number)}
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
      </section>
    </main>
  );
}
