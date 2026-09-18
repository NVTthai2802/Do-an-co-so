"use client";

import { useEffect, useRef } from "react";
import { motionAllowed } from "../lib/celebrate";

// Mục 4.3 (đã chốt): nhân vật đồng hành là ngôi sao "Bé Sao".
// TOÀN BỘ hình vẽ nằm trong đúng file này — nơi khác chỉ gọi <Mascot mood="..." />
// nên sau này muốn đổi nhân vật chỉ phải sửa một chỗ.

const MOUTHS = {
  idle: "M42 55 Q50 62 58 55",
  happy: "M38 53 Q50 68 62 53",
  think: "M43 58 Q50 56 57 58",
};

export default function Mascot({ mood = "idle", size = 84 }) {
  const ref = useRef(null);
  const prevMood = useRef(mood);

  useEffect(() => {
    if (prevMood.current === mood) return;
    prevMood.current = mood;

    if (mood !== "happy" || !motionAllowed() || !ref.current?.animate) return;

    ref.current.animate(
      [
        { transform: "translateY(0) rotate(0)" },
        { transform: "translateY(-14px) rotate(-8deg)" },
        { transform: "translateY(0) rotate(0)" },
      ],
      { duration: 500, easing: "cubic-bezier(.3,1.6,.5,1)" }
    );
  }, [mood]);

  return (
    <svg
      ref={ref}
      className="mascot"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M50 6l12.6 25.5 28.2 4.1-20.4 19.9 4.8 28.1L50 70.4 24.8 83.6l4.8-28.1L9.2 35.6l28.2-4.1z"
        fill="#FFC21A"
        stroke="#C2410C"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <circle cx="40" cy="44" r="4.5" fill="#1E2A4A" />
      <circle cx="60" cy="44" r="4.5" fill="#1E2A4A" />
      <circle cx="34" cy="54" r="4" fill="#FF8FB1" opacity=".7" />
      <circle cx="66" cy="54" r="4" fill="#FF8FB1" opacity=".7" />
      <path
        d={MOUTHS[mood] || MOUTHS.idle}
        stroke="#1E2A4A"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
