"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const parentLinks = [
  { href: "/dashboard", path: "/dashboard", label: "Tổng quan" },
  { href: "/dashboard/results", path: "/dashboard/results", label: "Báo cáo" },
  { href: "/dashboard/tools", path: "/dashboard/tools", label: "Công cụ cho bé" },
];

export default function ParentNav() {
  const pathname = usePathname();

  return (
    <nav className="lesson-nav" aria-label="Khu vuc quan ly">
      {parentLinks.map((item) => (
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
