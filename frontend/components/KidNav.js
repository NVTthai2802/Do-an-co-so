"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const kidLinks = [
  { href: "/hoc-tap?lesson=numbers", path: "/hoc-tap", label: "Số" },
  { href: "/hoc-tap/letters", path: "/hoc-tap/letters", label: "Chữ" },
  { href: "/hoc-tap/shapes", path: "/hoc-tap/shapes", label: "Hình" },
  { href: "/hoc-tap/time", path: "/hoc-tap/time", label: "Giờ" },
  { href: "/hoc-tap/document", path: "/hoc-tap/document", label: "Đọc tài liệu" },
  { href: "/hoc-tap/tts", path: "/hoc-tap/tts", label: "AI đọc" },
  { href: "/hoc-tap/stt", path: "/hoc-tap/stt", label: "Luyện đọc" },
];

export default function KidNav() {
  const pathname = usePathname();

  return (
    <nav className="lesson-nav" aria-label="Chuyen bai hoc">
      {kidLinks.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`lesson-nav-link ${pathname === item.path ? "active" : ""}`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
