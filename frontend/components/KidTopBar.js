"use client";

import Link from "next/link";

/**
 * Thanh trên cùng của màn bài học (Mục 4.3).
 * Chỉ MỘT hàng, cao 56–64px:  [🏠 Về lớp]  [thanh tiến độ]  [⭐ số sao]
 * Thay cho KidNav 8 nút + tiêu đề + nút "Quay lại" trước đây.
 *
 * subject: "num" | "let" | "shp" | "tim" | "rd"  -> màu của bài học.
 * progress: { current, total } -> thanh tiến độ lượt chơi (bỏ trống thì ẩn).
 * stars: số sao đã đạt (bỏ trống thì ẩn ô sao).
 * starBoxRef: ref tới ô ⭐ để ngôi sao bay tới (Mục 6.1 cấp 1).
 */
export default function KidTopBar({ subject = "num", title, progress, stars, starBoxRef }) {
  const steps = progress?.total || 0;
  const done = Math.min(progress?.current || 0, steps);

  return (
    <header className={`kid-topbar subject-${subject}`}>
      <Link href="/hoc-tap" className="kid-topbar-home" aria-label="Về lớp học">
        <span aria-hidden="true">🏠</span>
        <span className="kid-topbar-home-text">Về lớp</span>
      </Link>

      {steps > 0 ? (
        <div
          className="kid-topbar-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={steps}
          aria-valuenow={done}
          aria-label={`Câu ${done} trên ${steps}`}
        >
          {Array.from({ length: steps }, (_, index) => (
            <span key={index} className={`kid-step ${index < done ? "done" : ""}`} />
          ))}
        </div>
      ) : (
        <h1 className="kid-topbar-title">{title}</h1>
      )}

      {typeof stars === "number" ? (
        // Mục 5.11: bấm vào ô ⭐ cũng mở phòng huy hiệu.
        <Link
          ref={starBoxRef}
          href="/hoc-tap/huy-hieu"
          className="kid-topbar-stars"
          aria-label={`${stars} sao, mở phòng huy hiệu`}
        >
          <span aria-hidden="true">⭐</span>
          <strong>{stars}</strong>
        </Link>
      ) : (
        <span className="kid-topbar-spacer" aria-hidden="true" />
      )}
    </header>
  );
}
