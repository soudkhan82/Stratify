"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { label: string; href: string };

export default function TopNav() {
  const pathname = usePathname();

  const nav: NavItem[] = [
    { label: "Home", href: "/" },
    { label: "World", href: "/world" },
    { label: "Energy", href: "/energy" }, // ✅ NEW
    { label: "KPI", href: "/KPI" },
    { label: "Reports", href: "/reports" },
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-start px-4 sm:px-6 lg:px-8">
        <nav>
          <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-1 py-1 shadow-sm">
            {nav.map((n) => {
              const active = isActive(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={[
                    "rounded-xl px-4 py-2 text-sm font-medium transition",
                    active
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-700 hover:bg-slate-100",
                  ].join(" ")}
                >
                  {n.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </header>
  );
}
