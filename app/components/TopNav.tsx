"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthNavButton from "@/components/AuthNavButton";

const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Connect", href: "/connect" },
  { label: "Intelligence", href: "/intelligence" },
  { label: "Global Pulse", href: "/global-pulse" },
  { label: "Macro & Finance", href: "/macro-finance" },
  { label: "Energy", href: "/energy" },
  { label: "Agriculture", href: "/agriculture" },
  { label: "History", href: "/history" },
  { label: "Corporate 500", href: "/corporate-intelligence" },
  { label: "Credits", href: "/credits" },
];

const MOBILE_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Connect", href: "/connect" },
  { label: "Intelligence", href: "/intelligence" },
  { label: "Pulse", href: "/global-pulse" },
  { label: "Macro", href: "/macro-finance" },
  { label: "Energy", href: "/energy" },
  { label: "Agri", href: "/agriculture" },
  { label: "History", href: "/history" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  if (href === "/macro-finance") {
    return (
      pathname === "/macro-finance" ||
      pathname.startsWith("/macro-finance/") ||
      pathname === "/monetary" ||
      pathname.startsWith("/monetary/") ||
      pathname === "/fiscal" ||
      pathname.startsWith("/fiscal/") ||
      pathname === "/debt" ||
      pathname.startsWith("/debt/") ||
      pathname === "/imf-weo" ||
      pathname.startsWith("/imf-weo/") ||
      pathname.includes("dataset=weo")
    );
  }

  if (href === "/history") {
    return (
      pathname === "/history" ||
      pathname.startsWith("/history/")
    );
  }

  return (
    pathname === href ||
    pathname.startsWith(
      `${href}/`,
    )
  );
}

function DesktopNavLink({
  href,
  label,
  pathname,
}: {
  href: string;
  label: string;
  pathname: string;
}) {
  const active =
    isActivePath(
      pathname,
      href,
    );

  const connect =
    href === "/connect";

  return (
    <Link
      href={href}
      aria-current={
        active
          ? "page"
          : undefined
      }
      className={[
        "group relative flex h-10 items-center justify-center whitespace-nowrap rounded-[13px] px-2.5 text-[12px] font-medium tracking-[-0.01em] transition-all duration-200 xl:px-3 xl:text-[12.5px] 2xl:px-3.5",
        active
          ? "bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 !text-white shadow-[0_8px_22px_rgba(79,70,229,0.24)]"
          : connect
            ? "bg-indigo-50/75 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800"
            : "text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-[0_4px_14px_rgba(15,23,42,0.07)]",
      ].join(" ")}
    >
      <span className="relative z-10">
        {label}
      </span>

      {active ? (
        <span className="absolute -bottom-[7px] left-1/2 h-[3px] w-5 -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-500 to-blue-500 shadow-[0_2px_6px_rgba(79,70,229,0.28)]" />
      ) : null}
    </Link>
  );
}

function MobileNavLink({
  href,
  label,
  pathname,
}: {
  href: string;
  label: string;
  pathname: string;
}) {
  const active =
    isActivePath(
      pathname,
      href,
    );

  const connect =
    href === "/connect";

  return (
    <Link
      href={href}
      aria-current={
        active
          ? "page"
          : undefined
      }
      className={[
        "shrink-0 rounded-[12px] border px-3 py-2 text-[11px] font-medium transition-all",
        active
          ? "border-indigo-500 bg-gradient-to-r from-violet-600 to-blue-600 !text-white shadow-md shadow-indigo-200/60"
          : connect
            ? "border-indigo-100 bg-indigo-50 text-indigo-700"
            : "border-slate-200/80 bg-white/80 text-slate-600",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export default function TopNav() {
  const pathname =
    usePathname() ||
    "/";

  return (
    <header className="sticky top-0 z-[1200] border-b border-slate-200/70 bg-white/82 shadow-[0_5px_24px_rgba(15,23,42,0.055)] backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-300/70 to-transparent" />

      <div className="mx-auto flex h-[74px] w-full max-w-[1540px] items-center gap-4 px-4 sm:px-6 lg:px-7">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2.5"
          aria-label="Stratify Analytics home"
        >
          <div className="relative flex h-11 w-11 items-center justify-center rounded-[15px] bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 text-[16px] font-semibold text-white shadow-[0_9px_24px_rgba(79,70,229,0.25)] ring-1 ring-white/70 transition-transform duration-200 group-hover:-translate-y-0.5">
            <span className="relative z-10">
              S
            </span>

            <span className="pointer-events-none absolute inset-[1px] rounded-[14px] bg-gradient-to-br from-white/14 via-transparent to-transparent" />
          </div>

          <div className="hidden leading-tight sm:block">
            <div className="text-[17px] font-semibold tracking-[-0.025em] text-slate-800">
              Stratify
            </div>
            <div className="mt-0.5 text-[9.5px] font-medium uppercase tracking-[0.2em] text-slate-400">
              Analytics
            </div>
          </div>
        </Link>

        <div className="ml-auto hidden min-w-0 items-center gap-2 lg:flex">
          <nav
            aria-label="Primary navigation"
            className="relative flex min-w-0 items-center gap-0.5 rounded-[18px] border border-white/90 bg-gradient-to-b from-white/95 to-slate-50/88 p-1.5 shadow-[0_7px_24px_rgba(15,23,42,0.07)] ring-1 ring-slate-200/70 backdrop-blur-xl"
          >
            <span className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />

            {NAV_ITEMS.map(
              (item) => (
                <DesktopNavLink
                  key={
                    item.href
                  }
                  href={
                    item.href
                  }
                  label={
                    item.label
                  }
                  pathname={
                    pathname
                  }
                />
              ),
            )}
          </nav>

          <div className="shrink-0">
            <AuthNavButton />
          </div>
        </div>

        <div className="ml-auto flex min-w-0 flex-1 items-center gap-2 lg:hidden">
          <nav
            aria-label="Primary navigation"
            className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {MOBILE_ITEMS.map(
              (item) => (
                <MobileNavLink
                  key={
                    item.href
                  }
                  href={
                    item.href
                  }
                  label={
                    item.label
                  }
                  pathname={
                    pathname
                  }
                />
              ),
            )}
          </nav>

          <div className="shrink-0">
            <AuthNavButton />
          </div>
        </div>
      </div>
    </header>
  );
}
