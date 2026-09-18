"use client";

/**
 * Bộ biểu tượng hình học dùng chung (Mục 5.6).
 *
 * Tất cả vẽ lại bằng MỘT bộ SVG: cùng khung 100×100, cùng độ dày nét, tô
 * `--shp-400` và viền `--shp-700`. Không trộn emoji với ký tự unicode nữa —
 * trước đây mỗi hình một màu tự chọn và một emoji khác kiểu.
 *
 * Giống Mascot.js: toàn bộ hình vẽ nằm trong đúng file này, nơi khác chỉ gọi
 * <ShapeIcon id="tron" />.
 */

const STROKE = 7;

const PATHS = {
  tron: <circle cx="50" cy="50" r="38" />,
  vuong: <rect x="14" y="14" width="72" height="72" rx="4" />,
  tamgiac: <polygon points="50,12 88,84 12,84" />,
  chunhat: <rect x="10" y="26" width="80" height="48" rx="4" />,
  thoi: <polygon points="50,10 88,50 50,90 12,50" />,
  luc: <polygon points="50,10 87,30 87,70 50,90 13,70 13,30" />,
  sao: <polygon points="50,10 61,39 92,39 67,58 76,88 50,70 24,88 33,58 8,39 39,39" />,
  trai_tim: (
    <path d="M50 84 C50 84 12 58 12 36 C12 22 24 13 36 17 C43 19 50 27 50 27 C50 27 57 19 64 17 C76 13 88 22 88 36 C88 58 50 84 50 84Z" />
  ),
  // Nhóm "Nét": chỉ có viền, không tô.
  duong_thang: <line x1="14" y1="50" x2="86" y2="50" strokeLinecap="round" />,
};

// Nét thì không tô màu, để bé thấy rõ đây là một đường chứ không phải hình.
const STROKE_ONLY = new Set(["duong_thang"]);

export default function ShapeIcon({ id, size = 120, title }) {
  const shape = PATHS[id];
  if (!shape) return null;

  return (
    <svg
      className="shape-icon"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={title ? "img" : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : "true"}
      focusable="false"
      fill={STROKE_ONLY.has(id) ? "none" : "var(--shp-400)"}
      stroke="var(--shp-700)"
      strokeWidth={id === "duong_thang" ? STROKE + 2 : STROKE}
      strokeLinejoin="round"
    >
      {shape}
    </svg>
  );
}

export const SHAPE_IDS = Object.keys(PATHS);
