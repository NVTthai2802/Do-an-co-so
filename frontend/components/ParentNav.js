"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const parentLinks = [{ href: "/dashboard/results", path: "/dashboard/results", label: "Báo cáo" }];

export default function ParentNav() {
  const pathname = usePathname();

  return (
    <nav className="lesson-nav" aria-label="Quan ly">
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
