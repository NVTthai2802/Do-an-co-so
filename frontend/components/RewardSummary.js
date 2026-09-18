"use client";

import { useEffect, useRef, useState } from "react";
import { celebrateFinish } from "../lib/celebrate";
import { sfx } from "../lib/sfx";
import { speakVietnamese } from "../lib/speech";
import Mascot from "./Mascot";

/**
 * Cấp 3 – hộp thoại tổng kết cuối lượt chơi (Mục 6.1).
 *
 * Sao hiện lần lượt, pháo hoa chạy tối đa 2,2 giây rồi dừng; đóng hộp thoại
 * thì dừng hẳn. Bé luôn nhận ít nhất 1 sao kèm lời khen nỗ lực.
 */
export default function RewardSummary({ stars, total, correctFirstTry, onReplay, onHome, unit = "câu", summaryText }) {
  const [shown, setShown] = useState(0);
  const replayRef = useRef(null);
  const stopRef = useRef(null);

  useEffect(() => {
    stopRef.current = celebrateFinish();
    sfx.finish();
    speakVietnamese("Hoan hô! Con làm xong bài rồi!");

    return () => {
      if (stopRef.current) stopRef.current();
    };
  }, []);

  // Sao hiện lần lượt, mỗi sao một nốt cao dần.
  useEffect(() => {
    if (shown >= stars) return undefined;
    const timer = setTimeout(() => {
      setShown((n) => n + 1);
      sfx.star(shown);
    }, 420 + shown * 120);
    return () => clearTimeout(timer);
  }, [shown, stars]);

  // Tự đưa con trỏ vào nút "Chơi tiếp" để điều khiển được bằng bàn phím.
  useEffect(() => {
    replayRef.current?.focus();
  }, []);

  function handleKeyDown(event) {
    if (event.key === "Escape") onHome();
  }

  return (
    <div className="reward-overlay" role="dialog" aria-modal="true" aria-label="Kết quả lượt chơi" onKeyDown={handleKeyDown}>
      <div className="reward-card">
        <Mascot mood="happy" size={96} />

        <h2>Hoan hô!</h2>
        <p className="reward-line">
          {summaryText || `Con làm đúng ngay lần đầu ${correctFirstTry} trên ${total} ${unit}.`}
        </p>

        <div className="reward-stars" aria-label={`${stars} trên 3 sao`}>
          {[0, 1, 2].map((index) => (
            <span key={index} className={`reward-star ${index < shown ? "on" : ""}`} aria-hidden="true">
              ⭐
            </span>
          ))}
        </div>

        <div className="reward-actions">
          <button ref={replayRef} type="button" className="kbtn subject-ok" onClick={onReplay}>
            ▶ Chơi tiếp
          </button>
          <button type="button" className="kbtn soft subject-num" onClick={onHome}>
            🏠 Về lớp
          </button>
        </div>
      </div>
    </div>
  );
}
