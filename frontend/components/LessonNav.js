"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const lessonLinks = [
  { href: "/dashboard?lesson=numbers", path: "/dashboard", label: "Số" },
  { href: "/dashboard/letters", path: "/dashboard/letters", label: "Chữ" },
  { href: "/dashboard/shapes", path: "/dashboard/shapes", label: "Hình" },
  { href: "/dashboard/time", path: "/dashboard/time", label: "Giờ" },
  { href: "/dashboard/results", path: "/dashboard/results", label: "Báo cáo" },
];

export default function LessonNav() {
  const pathname = usePathname();

  return (
    <nav className="lesson-nav" aria-label="Chuyen phan he">
      {lessonLinks.map((item) => (
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
