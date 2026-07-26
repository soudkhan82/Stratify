"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Building2,
  ChevronLeft,
  ChevronRight,
  Database,
  Globe2,
  History,
  Loader2,
  Newspaper,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Snapshot = {
  image: string;
  eyebrow: string;
  title: string;
  description: string;
  href: string;
};

const SNAPSHOTS: Snapshot[] = [
  {
    image: "/landing/world-intelligence-dashboard.png",
    eyebrow: "World Intelligence Dashboard",
    title: "Start with the world. Drill into every country.",
    description:
      "Compare global indicators on an interactive map, then open detailed national intelligence profiles.",
    href: "/",
  },
  {
    image: "/landing/global-pulse.png",
    eyebrow: "Global Pulse",
    title: "Live news, official updates and historical context.",
    description:
      "Follow the forces shaping the geo-social economy through a fast, visual intelligence feed.",
    href: "/global-pulse",
  },
  {
    image: "/landing/country-intelligence.png",
    eyebrow: "Country Intelligence",
    title: "Economic context beyond a single number.",
    description:
      "Move from population and GDP to macroeconomic, trade and business context in one profile.",
    href: "/world",
  },
  {
    image: "/landing/history-explorer.png",
    eyebrow: "History & Events Explorer",
    title: "Understand today through the timelines behind it.",
    description:
      "Explore conflicts, civilizations and historical records with timeline and frequency-driven discovery.",
    href: "/history",
  },
  {
    image: "/landing/one-platform.png",
    eyebrow: "One Platform",
    title: "Global insights across economics, energy and society.",
    description:
      "Bring fiscal, debt, energy, agriculture, monetary and corporate intelligence into one connected workspace.",
    href: "/",
  },
];

const BRIEFINGS = [
  {
    category: "Geo-economy",
    title: "Follow trade, inflation and policy signals without losing the global context.",
    icon: Newspaper,
  },
  {
    category: "Energy",
    title: "Compare transition indicators, production, access and long-term energy trends.",
    icon: Zap,
  },
  {
    category: "History",
    title: "Connect present-day developments with conflicts, timelines and turning points.",
    icon: History,
  },
  {
    category: "Corporate",
    title: "Explore companies, sectors, headquarters and enriched business profiles.",
    icon: Building2,
  },
];

const FEATURES = [
  {
    icon: Globe2,
    title: "Global coverage",
    text: "Move from a world map to detailed country intelligence.",
  },
  {
    icon: Database,
    title: "Trusted sources",
    text: "Public datasets organized for faster comparison and discovery.",
  },
  {
    icon: BarChart3,
    title: "Decision-ready visuals",
    text: "Turn complex indicators into clear maps, trends and rankings.",
  },
  {
    icon: ShieldCheck,
    title: "Secure access",
    text: "Enter through Google authentication and continue to your dashboard.",
  },
];

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [slideIndex, setSlideIndex] = useState(0);
  const [briefIndex, setBriefIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSlideIndex((current) => (current + 1) % SNAPSHOTS.length);
    }, 5600);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setBriefIndex((current) => (current + 1) % BRIEFINGS.length);
    }, 3600);

    return () => window.clearInterval(timer);
  }, []);

  async function signInWithGoogle() {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const supabase = createClient();

      const nextPath = safeNextPath(
        new URLSearchParams(window.location.search).get("next"),
      );

      const secureCookie =
        window.location.protocol === "https:" ? "; Secure" : "";

      document.cookie =
        `stratify_auth_next=${encodeURIComponent(nextPath)}` +
        `; Path=/; Max-Age=600; SameSite=Lax${secureCookie}`;

      /*
       * IMPORTANT:
       * Keep the OAuth callback exact. Do not attach ?next here.
       *
       * Local:
       * http://localhost:3000/auth/callback
       *
       * Production:
       * https://worldstats360.com/auth/callback
       */
      const callbackUrl = new URL(
        "/auth/callback",
        window.location.origin,
      );

      const { data, error: signInError } =
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: callbackUrl.toString(),
            skipBrowserRedirect: true,
          },
        });

      if (signInError) {
        throw signInError;
      }

      if (!data?.url) {
        throw new Error(
          "Supabase did not return a Google authorization URL.",
        );
      }

      window.location.assign(data.url);
    } catch (signInError) {
      console.error("GOOGLE SIGN-IN START FAILED", signInError);

      setError(
        signInError instanceof Error
          ? signInError.message
          : "Google sign-in could not be started.",
      );

      setLoading(false);
    }
  }
  function previousSlide() {
    setSlideIndex((current) =>
      current === 0 ? SNAPSHOTS.length - 1 : current - 1,
    );
  }

  function nextSlide() {
    setSlideIndex((current) => (current + 1) % SNAPSHOTS.length);
  }

  const activeSlide = SNAPSHOTS[slideIndex];

  return (
    <div className="stratify-login-shell relative min-h-[calc(100vh-78px)] overflow-hidden bg-[#030718] text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            "linear-gradient(rgba(124,58,237,.14) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,.10) 1px, transparent 1px)",
          backgroundSize: "58px 58px",
          maskImage:
            "linear-gradient(to bottom, black 0%, rgba(0,0,0,.75) 55%, transparent 100%)",
        }}
      />
      <div className="pointer-events-none absolute -left-40 top-8 h-[520px] w-[520px] rounded-full bg-violet-600/20 blur-[130px]" />
      <div className="pointer-events-none absolute -right-36 top-32 h-[560px] w-[560px] rounded-full bg-cyan-500/15 blur-[145px]" />

      <section className="relative mx-auto grid max-w-[1500px] gap-8 px-5 pb-10 pt-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:px-8 lg:pb-14 lg:pt-14">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/25 bg-violet-400/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-violet-100 shadow-[0_0_30px_rgba(124,58,237,.12)]">
            <Sparkles className="h-3.5 w-3.5" />
            Global intelligence. One secure entry.
          </div>

          <h1 className="mt-6 max-w-3xl text-4xl font-black leading-[0.98] tracking-[-0.045em] text-white sm:text-5xl lg:text-[68px]">
            Enter the world of
            <span className="block bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">
              connected intelligence.
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-base font-medium leading-7 text-slate-300 sm:text-lg">
            Explore global indicators, country profiles, breaking developments,
            history, energy, fiscal intelligence and corporate insights through
            one fast, visual analytics platform.
          </p>

          <div id="sign-in" className="mt-8 max-w-xl rounded-[26px] border border-white/10 bg-white/[0.055] p-3 shadow-[0_28px_90px_rgba(0,0,0,.34)] backdrop-blur-xl">
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={loading}
              className="stratify-google-button group flex w-full items-center justify-center gap-3 rounded-[19px] bg-white px-5 py-4 text-sm font-black text-slate-950 shadow-[0_12px_35px_rgba(255,255,255,.12)] transition hover:-translate-y-0.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-65"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <span className="grid h-7 w-7 place-items-center rounded-full border border-slate-200 bg-white text-base font-black">
                  <span className="bg-gradient-to-br from-blue-600 via-red-500 to-amber-400 bg-clip-text text-transparent">
                    G
                  </span>
                </span>
              )}
              {loading ? "Opening Google sign-in..." : "Continue with Google"}
              {!loading ? (
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              ) : null}
            </button>

            <p className="px-3 pb-1 pt-3 text-center text-xs font-semibold leading-5 text-slate-300">
              Enter the world of data-driven discovery, global context and
              smarter decisions.
            </p>

            {error ? (
              <div className="mt-3 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100">
                {error}
              </div>
            ) : null}
          </div>

          <div className="mt-7 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;

              return (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.045] p-3.5 backdrop-blur-md"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="mt-3 text-sm font-black text-white">
                    {feature.title}
                  </div>
                  <div className="mt-1 text-[11px] font-medium leading-4 text-slate-400">
                    {feature.text}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative min-w-0">
          <div className="absolute -inset-4 rounded-[40px] bg-gradient-to-r from-violet-600/20 via-blue-500/10 to-cyan-400/20 blur-2xl" />

          <div className="relative overflow-hidden rounded-[32px] border border-white/15 bg-[#071026] p-2 shadow-[0_38px_110px_rgba(0,0,0,.55)]">
            <div className="relative aspect-[16/9] overflow-hidden rounded-[25px] bg-slate-950">
              {SNAPSHOTS.map((slide, index) => (
                <img
                  key={slide.image}
                  src={slide.image}
                  alt={slide.title}
                  className={`absolute inset-0 h-full w-full object-cover transition duration-700 ${
                    index === slideIndex
                      ? "scale-100 opacity-100"
                      : "scale-[1.025] opacity-0"
                  }`}
                />
              ))}

              <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-[#020617]/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                <div className="inline-flex rounded-full border border-white/20 bg-black/35 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100 backdrop-blur-md">
                  {activeSlide.eyebrow}
                </div>
                <h2 className="mt-3 max-w-3xl text-xl font-black leading-tight text-white sm:text-3xl">
                  {activeSlide.title}
                </h2>
                <p className="mt-2 hidden max-w-2xl text-sm font-medium leading-6 text-slate-200 sm:block">
                  {activeSlide.description}
                </p>
                <a
                  href={activeSlide.href}
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black text-white backdrop-blur-md transition hover:bg-white/20"
                >
                  Explore after sign-in
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>

              <button
                type="button"
                onClick={previousSlide}
                aria-label="Previous snapshot"
                className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md transition hover:bg-black/60"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={nextSlide}
                aria-label="Next snapshot"
                className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md transition hover:bg-black/60"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4 px-3 pb-2 pt-4">
              <div className="flex gap-2">
                {SNAPSHOTS.map((slide, index) => (
                  <button
                    key={slide.image}
                    type="button"
                    onClick={() => setSlideIndex(index)}
                    aria-label={`Open snapshot ${index + 1}`}
                    className={`h-1.5 rounded-full transition-all ${
                      index === slideIndex
                        ? "w-10 bg-violet-400"
                        : "w-4 bg-white/25 hover:bg-white/45"
                    }`}
                  />
                ))}
              </div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                {String(slideIndex + 1).padStart(2, "0")} / {String(SNAPSHOTS.length).padStart(2, "0")}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative border-y border-white/10 bg-white/[0.035]">
        <div className="mx-auto grid max-w-[1500px] gap-5 px-5 py-6 lg:grid-cols-[0.34fr_0.66fr] lg:px-8">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-violet-300">
              Crisp intelligence
            </div>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
              See what is moving the world.
            </h2>
            <p className="mt-2 max-w-lg text-sm font-medium leading-6 text-slate-400">
              A rotating preview of the themes and analytical journeys waiting
              inside Stratify.
            </p>
          </div>

          <div className="relative min-h-[132px] overflow-hidden rounded-[24px] border border-white/10 bg-[#071026]/80 p-5 shadow-[0_20px_55px_rgba(0,0,0,.25)]">
            {BRIEFINGS.map((brief, index) => {
              const Icon = brief.icon;

              return (
                <div
                  key={brief.category}
                  className={`absolute inset-0 flex items-center gap-4 p-5 transition duration-500 ${
                    index === briefIndex
                      ? "translate-y-0 opacity-100"
                      : "translate-y-4 opacity-0"
                  }`}
                >
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-violet-300/20 bg-violet-400/10 text-violet-200">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
                      {brief.category}
                    </div>
                    <div className="mt-2 max-w-3xl text-lg font-black leading-6 text-white sm:text-xl">
                      {brief.title}
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="absolute bottom-3 right-4 flex gap-1.5">
              {BRIEFINGS.map((brief, index) => (
                <button
                  key={brief.category}
                  type="button"
                  onClick={() => setBriefIndex(index)}
                  aria-label={`Open ${brief.category} briefing`}
                  className={`h-1.5 rounded-full transition-all ${
                    index === briefIndex ? "w-7 bg-cyan-300" : "w-2 bg-white/20"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-[1500px] px-5 py-9 lg:px-8 lg:py-12">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-300">
              Inside Stratify
            </div>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-white">
              From a world map to a complete intelligence journey.
            </h2>
          </div>
          <div className="inline-flex items-center gap-2 text-sm font-bold text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            Google-authenticated access
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            {
              number: "01",
              title: "Discover",
              text: "Start with global maps, rankings and cross-country comparisons.",
            },
            {
              number: "02",
              title: "Understand",
              text: "Open country, history, fiscal, energy and corporate context.",
            },
            {
              number: "03",
              title: "Decide",
              text: "Turn connected evidence into clearer questions and smarter decisions.",
            },
          ].map((item) => (
            <div
              key={item.number}
              className="rounded-[24px] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-md"
            >
              <div className="text-xs font-black tracking-[0.2em] text-violet-300">
                {item.number}
              </div>
              <div className="mt-4 text-xl font-black text-white">{item.title}</div>
              <div className="mt-2 text-sm font-medium leading-6 text-slate-400">
                {item.text}
              </div>
            </div>
          ))}
        </div>
      </section>
      {/* STRATIFY LANDING CONTRAST LOCK — DO NOT REMOVE */}
      <style>{`
        /*
         * Route-scoped rules intentionally use !important.
         * This prevents global theme styles from turning landing-page
         * text dark on the navy background.
         */
        .stratify-login-shell {
          color: #f8fafc !important;
        }

        .stratify-login-shell .text-white {
          color: #ffffff !important;
        }

        .stratify-login-shell .text-slate-200 {
          color: #e2e8f0 !important;
        }

        .stratify-login-shell .text-slate-300 {
          color: #dbeafe !important;
        }

        .stratify-login-shell .text-slate-400 {
          color: #cbd5e1 !important;
        }

        .stratify-login-shell .text-violet-100 {
          color: #ede9fe !important;
        }

        .stratify-login-shell .text-violet-200 {
          color: #ddd6fe !important;
        }

        .stratify-login-shell .text-violet-300 {
          color: #c4b5fd !important;
        }

        .stratify-login-shell .text-cyan-100 {
          color: #cffafe !important;
        }

        .stratify-login-shell .text-cyan-200 {
          color: #a5f3fc !important;
        }

        .stratify-login-shell .text-cyan-300 {
          color: #67e8f9 !important;
        }

        .stratify-login-shell .text-emerald-300 {
          color: #6ee7b7 !important;
        }

        .stratify-login-shell .text-rose-100 {
          color: #ffe4e6 !important;
        }

        /*
         * The Google sign-in button has a white background,
         * so its foreground must remain dark.
         */
        .stratify-login-shell .stratify-google-button {
          color: #020617 !important;
        }

        .stratify-login-shell .stratify-google-button .text-slate-950 {
          color: #020617 !important;
        }
      `}</style>
    </div>
  );
}
