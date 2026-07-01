"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthNavButton from "@/components/AuthNavButton";

const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Debt", href: "/debt" },
  { label: "Energy", href: "/energy" },
  { label: "FAO", href: "/faostat" },
  { label: "Fiscal", href: "/fiscal" },
  { label: "IMF (WEO)", href: "/imf-weo" },
  { label: "History", href: "/history" },
  { label: "Corporate 500", href: "/corporate-intelligence" },
  { label: "Credits", href: "/credits" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";

  if (href === "/faostat") {
    return (
      pathname === "/faostat" ||
      pathname.startsWith("/faostat/") ||
      pathname.includes("dataset=faostat") ||
      pathname.includes("dataset=fao")
    );
  }

  if (href === "/imf-weo") {
    return (
      pathname === "/imf-weo" ||
      pathname.startsWith("/imf-weo/") ||
      pathname.includes("dataset=weo")
    );
  }

  if (href === "/history") {
    return pathname === "/history" || pathname.startsWith("/history/");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function TopNav() {
  const pathname = usePathname() || "/";

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] w-full max-w-[1480px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 text-lg font-black text-white shadow-lg shadow-violet-200">
            S
          </div>

          <div className="leading-tight">
            <div className="text-lg font-black tracking-tight text-slate-950">
              Stratify
            </div>
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Analytics
            </div>
          </div>
        </Link>

        <div className="ml-auto hidden items-center gap-3 md:flex">
          <nav className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1.5 shadow-sm">
            {NAV_ITEMS.map((item) => {
              const active = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "rounded-full px-3 py-2 text-sm font-bold transition-all xl:px-3.5",
                    active
                      ? "bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-md shadow-violet-200"
                      : "text-slate-600 hover:bg-white hover:text-slate-950 hover:shadow-sm",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <AuthNavButton />
        </div>

        <div className="ml-auto flex items-center gap-2 md:hidden">
          <Link
            href="/"
            className={[
              "rounded-full px-3 py-2 text-xs font-black shadow-md",
              pathname === "/"
                ? "bg-violet-600 text-white shadow-violet-200"
                : "bg-slate-100 text-slate-700 shadow-none",
            ].join(" ")}
          >
            Home
          </Link>

          <Link
            href="/history"
            className={[
              "rounded-full px-3 py-2 text-xs font-black",
              pathname.startsWith("/history")
                ? "bg-violet-600 text-white shadow-md shadow-violet-200"
                : "bg-slate-100 text-slate-700",
            ].join(" ")}
          >
            History
          </Link>

          <Link
            href="/faostat"
            className={[
              "rounded-full px-3 py-2 text-xs font-black",
              pathname.startsWith("/faostat")
                ? "bg-violet-600 text-white shadow-md shadow-violet-200"
                : "bg-slate-100 text-slate-700",
            ].join(" ")}
          >
            FAO
          </Link>

          <Link
            href="/imf-weo"
            className={[
              "rounded-full px-3 py-2 text-xs font-black",
              pathname.startsWith("/imf-weo")
                ? "bg-violet-600 text-white shadow-md shadow-violet-200"
                : "bg-slate-100 text-slate-700",
            ].join(" ")}
          >
            IMF
          </Link>

          <AuthNavButton />
        </div>
      </div>
    </header>
  );
}
