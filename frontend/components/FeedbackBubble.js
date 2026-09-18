"use client";

import Mascot from "./Mascot";

/**
 * Nhân vật + bong bóng lời nói (Mục 4.3 / 6.1).
 *
 * Vùng này có CHIỀU CAO CỐ ĐỊNH (.mascot-row, min-height 92px) để khi hiện
 * phản hồi thì bố cục không bị nhảy — một trong các mục nghiệm thu của
 * Giai đoạn 3.
 *
 * aria-live="polite" để trình đọc màn hình đọc phản hồi mà không cắt ngang.
 */
export default function FeedbackBubble({ mood = "idle", message, hint }) {
  return (
    <div className="mascot-row">
      <Mascot mood={mood} />
      <div className="bubble" aria-live="polite">
        <span>{message}</span>
        {hint ? <em className="bubble-hint">{hint}</em> : null}
      </div>
    </div>
  );
}
