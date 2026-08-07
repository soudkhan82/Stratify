"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Globe2,
  History,
  Loader2,
  Newspaper,
  ShieldCheck,
  Zap,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

const MODULES = [
  {
    title: "Global Pulse",
    text: "News, official updates and historical context in one intelligence feed.",
    href: "/global-pulse",
    icon: Newspaper,
  },
  {
    title: "World Intelligence",
    text: "Compare countries through trusted indicators and country profiles.",
    href: "/",
    icon: Globe2,
  },
  {
    title: "Monetary",
    text: "Explore inflation, rates, reserves, banking and capital-market signals.",
    href: "/monetary",
    icon: BarChart3,
  },
  {
    title: "Fiscal",
    text: "Review revenue, expenditure, balances and public-finance trends.",
    href: "/fiscal",
    icon: Building2,
  },
  {
    title: "Energy",
    text: "Track production, access, transition and long-term energy indicators.",
    href: "/energy",
    icon: Zap,
  },
  {
    title: "History",
    text: "Connect current events with timelines, conflicts and turning points.",
    href: "/history",
    icon: History,
  },
];

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

function GoogleLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4.5 w-4.5 shrink-0">
      <path
        fill="#4285F4"
        d="M21.35 12.24c0-.72-.06-1.25-.2-1.8H12v3.48h5.37a4.6 4.6 0 0 1-2 2.93v2.3h3.23c1.89-1.74 2.75-4.3 2.75-6.91Z"
      />
      <path
        fill="#34A853"
        d="M12 21.75c2.7 0 4.96-.9 6.61-2.43l-3.23-2.3c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.08v2.37A9.99 9.99 0 0 0 12 21.75Z"
      />
      <path
        fill="#FBBC05"
        d="M6.41 13.86A6 6 0 0 1 6.1 12c0-.65.11-1.28.31-1.86V7.77H3.08A9.98 9.98 0 0 0 2 12c0 1.52.34 2.96 1.08 4.23l3.33-2.37Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.02c1.47 0 2.79.5 3.83 1.5l2.86-2.87A9.58 9.58 0 0 0 12 2.25a9.99 9.99 0 0 0-8.92 5.52l3.33 2.37C7.2 7.78 9.4 6.02 12 6.02Z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function signInWithGoogle() {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const nextPath = safeNextPath(
        new URLSearchParams(window.location.search).get("next"),
      );

      document.cookie = `stratify_auth_next=${encodeURIComponent(
        nextPath,
      )}; Path=/; Max-Age=600; SameSite=Lax`;

      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
            nextPath,
          )}`,
        },
      });

      if (signInError) throw signInError;
    } catch (signInError) {
      setError(
        signInError instanceof Error
          ? signInError.message
          : "Google sign-in could not be started.",
      );
      setLoading(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[#f6f7f9] text-slate-800">
      <section className="mx-auto w-full max-w-[1380px] px-5 pb-12 pt-10 sm:px-7 lg:px-10 lg:pb-16 lg:pt-14">
        <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
          <div className="max-w-[650px]">
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              Stratify Intelligence
            </div>

            <h1 className="mt-5 max-w-[620px] text-[42px] font-semibold leading-[1.05] tracking-[-0.035em] text-slate-950 sm:text-[52px] lg:text-[58px]">
              See the world in context.
            </h1>

            <p className="mt-5 max-w-[610px] text-[16px] font-normal leading-7 text-slate-600 sm:text-[17px]">
              Explore global indicators, live developments, country intelligence,
              history, energy, fiscal data and corporate context through one
              connected research platform.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Explore Stratify
                <ArrowRight className="h-4 w-4" />
              </Link>

              <button
                type="button"
                onClick={signInWithGoogle}
                disabled={loading}
                className="inline-flex h-11 items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                ) : (
                  <GoogleLogo />
                )}
                {loading ? "Opening Google..." : "Continue with Google"}
              </button>
            </div>

            <div className="mt-4 flex items-start gap-2 text-[12px] leading-5 text-slate-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <span>
                Sign-in is optional. Public intelligence remains available
                without an account.
              </span>
            </div>

            {error ? (
              <div className="mt-4 max-w-[610px] rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {error}
              </div>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white p-2 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <div className="overflow-hidden rounded-[16px] bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/landing/world-intelligence-dashboard.png"
                alt="Stratify World Intelligence Dashboard"
                className="aspect-[16/9] w-full object-cover object-top"
                loading="eager"
                decoding="async"
              />
            </div>

            <div className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  World Intelligence Dashboard
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  Start globally, then drill into country-level evidence.
                </div>
              </div>

              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 transition hover:text-indigo-800"
              >
                Open dashboard
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-14 border-t border-slate-200 pt-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Explore the platform
              </div>
              <h2 className="mt-1.5 text-2xl font-semibold tracking-[-0.02em] text-slate-900">
                One portal, several ways to understand the world.
              </h2>
            </div>

            <p className="max-w-[480px] text-sm leading-6 text-slate-500">
              Choose a module directly. No login gate is placed between visitors
              and the public data.
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map(({ title, text, href, icon: Icon }) => (
              <Link
                key={title}
                href={href}
                className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-[0_8px_24px_rgba(15,23,42,0.05)]"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                    <Icon className="h-4.5 w-4.5" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-[15px] font-semibold text-slate-900">
                        {title}
                      </h3>
                      <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-600" />
                    </div>
                    <p className="mt-1 text-[13px] font-normal leading-5 text-slate-500">
                      {text}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-slate-200 pt-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>Stratify Â· Global data and context in one place</span>
          <span>Browse first. Sign in only when you want an account session.</span>
        </div>
      </section>
    </main>
  );
}
