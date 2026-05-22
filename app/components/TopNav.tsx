"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Debt", href: "/debt" },
  { label: "Energy", href: "/energy" },
  { label: "FAO", href: "/faostat" },
  { label: "Fiscal", href: "/fiscal" },
];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-[#eceef5] bg-white/88 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] w-full max-w-[1480px] items-center gap-5 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
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

        <nav className="ml-auto flex items-center gap-1 rounded-full border border-[#e6e8ef] bg-[#f8f9fd] p-1.5 shadow-sm">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "rounded-full px-4 py-2 text-sm font-bold transition-all",
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
      </div>
    </header>
  );
}
