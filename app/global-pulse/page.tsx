"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Building2,
  CheckCircle2,
  Clock3,
  Database,
  ExternalLink,
  Globe2,
  History,
  Landmark,
  Loader2,
  Newspaper,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wheat,
  XCircle,
  Zap,
} from "lucide-react";

import type {
  PulseItem,
  PulseResponse,
  PulseSourceStatus,
  PulseTopic,
} from "@/app/api/_lib/global-pulse/types";

const TOPICS: Array<{ key: PulseTopic; label: string }> = [
  { key: "all", label: "Top Stories" },
  { key: "geo-economy", label: "Geo-Economy" },
  { key: "geopolitics", label: "Geopolitics" },
  { key: "energy", label: "Energy" },
  { key: "trade", label: "Trade" },
  { key: "food", label: "Food" },
  { key: "climate", label: "Climate" },
  { key: "society", label: "Society" },
  { key: "health", label: "Health" },
  { key: "crises", label: "Crises" },
  { key: "pakistan", label: "Pakistan" },
  { key: "history", label: "Today in History" },
];

const EMPTY_RESPONSE: PulseResponse = {
  ok: false,
  generatedAt: "",
  filters: { topic: "all", q: "", country: "", hours: 168 },
  counts: {
    total: 0,
    sourcesOk: 0,
    sourcesTotal: 7,
    official: 0,
    publishers: 0,
  },
  hero: null,
  items: [],
  officialUpdates: [],
  todayInHistory: [],
  trending: [],
  sourceStatus: [],
  warnings: [],
};

function formatRelative(value: string | null) {
  if (!value) return "Time unavailable";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Time unavailable";

  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 2) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 8) return `${days} day${days === 1 ? "" : "s"} ago`;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

function formatYear(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Historic event";
  }
  return value < 0 ? `${Math.abs(value)} BC` : String(value);
}

function topicLabel(topic: PulseItem["topic"]) {
  return (
    TOPICS.find((item) => item.key === topic)?.label ??
    topic.replace(/-/g, " ")
  );
}

function topicClasses(topic: PulseItem["topic"]) {
  switch (topic) {
    case "energy":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "trade":
      return "border-blue-200 bg-blue-50 text-blue-800";
    case "food":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "climate":
      return "border-teal-200 bg-teal-50 text-teal-800";
    case "crises":
    case "geopolitics":
      return "border-rose-200 bg-rose-50 text-rose-800";
    case "pakistan":
      return "border-green-200 bg-green-50 text-green-800";
    case "history":
      return "border-violet-200 bg-violet-50 text-violet-800";
    default:
      return "border-indigo-200 bg-indigo-50 text-indigo-800";
  }
}

function SourceBadge({ item }: { item: PulseItem }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em]",
        item.isOfficial
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-slate-200 bg-white/90 text-slate-700",
      ].join(" ")}
    >
      {item.isOfficial ? <ShieldCheck className="h-3 w-3" /> : null}
      {item.source}
    </span>
  );
}

function TopicBadge({ topic }: { topic: PulseItem["topic"] }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${topicClasses(topic)}`}
    >
      {topicLabel(topic)}
    </span>
  );
}

function SectionHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
}: {
  icon: typeof Globe2;
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
          {eyebrow}
        </div>
        <h2 className="mt-0.5 text-xl font-black tracking-tight text-slate-950">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-xs font-medium text-slate-500">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

function HeroStory({ item }: { item: PulseItem }) {
  return (
    <article className="group relative min-h-[430px] overflow-hidden rounded-[30px] border border-slate-200 bg-slate-950 shadow-xl shadow-slate-300/40">
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-blue-900 to-slate-950" />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-slate-950/10" />
      <div className="absolute inset-x-0 bottom-0 z-10 p-6 sm:p-8">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <SourceBadge item={item} />
          <TopicBadge topic={item.topic} />
        </div>

        <h1 className="max-w-4xl text-3xl font-black leading-tight tracking-[-0.035em] text-white sm:text-4xl">
          {item.title}
        </h1>

        {item.summary ? (
          <p className="mt-4 max-w-3xl text-sm font-medium leading-6 text-slate-200 sm:text-[15px]">
            {item.summary}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-black text-slate-950 shadow-lg transition hover:bg-slate-100"
          >
            Read original
            <ExternalLink className="h-4 w-4" />
          </a>

          <Link
            href={item.moduleHref}
            className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-black text-white backdrop-blur transition hover:bg-white/20"
          >
            {item.moduleLabel}
            <ArrowUpRight className="h-4 w-4" />
          </Link>

          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-300">
            <Clock3 className="h-3.5 w-3.5" />
            {formatRelative(item.publishedAt)}
          </span>
        </div>
      </div>
    </article>
  );
}

function StoryCard({ item, compact = false }: { item: PulseItem; compact?: boolean }) {
  return (
    <article className="group overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      {item.imageUrl ? (
        <div className={compact ? "h-32 overflow-hidden" : "h-44 overflow-hidden"}>
          <img
            src={item.imageUrl}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </div>
      ) : (
        <div
          className={[
            compact ? "h-24" : "h-32",
            "flex items-center justify-center bg-gradient-to-br from-indigo-100 via-blue-50 to-emerald-50",
          ].join(" ")}
        >
          <Newspaper className="h-9 w-9 text-indigo-500" />
        </div>
      )}

      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <TopicBadge topic={item.topic} />
          {item.isOfficial ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.08em] text-emerald-700">
              <ShieldCheck className="h-3 w-3" /> Official
            </span>
          ) : null}
        </div>

        <h3 className="mt-3 line-clamp-3 text-[17px] font-black leading-[1.28] tracking-tight text-slate-950">
          {item.title}
        </h3>

        {!compact && item.summary ? (
          <p className="mt-2 line-clamp-3 text-xs font-medium leading-5 text-slate-600">
            {item.summary}
          </p>
        ) : null}

        <div className="mt-4 flex items-end justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="min-w-0">
            <div className="truncate text-xs font-black text-slate-700">
              {item.source}
            </div>
            <div className="mt-0.5 text-[11px] font-semibold text-slate-400">
              {formatRelative(item.publishedAt)}
            </div>
          </div>

          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${item.title}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white transition hover:bg-indigo-700"
          >
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </article>
  );
}

function HistoryCard({ item }: { item: PulseItem }) {
  return (
    <article className="rounded-[22px] border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-violet-700">
        <History className="h-4 w-4" />
        {formatYear(item.year)}
      </div>
      <h3 className="mt-2 line-clamp-3 text-[15px] font-black leading-5 text-slate-950">
        {item.title}
      </h3>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-slate-500">Wikipedia</span>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-black text-violet-700 hover:text-violet-900"
        >
          Read
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </article>
  );
}

function SourceHealth({ status }: { status: PulseSourceStatus }) {
  const healthy = status.ok;

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        {healthy ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
        ) : status.configured ? (
          <XCircle className="h-4 w-4 shrink-0 text-rose-600" />
        ) : (
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
        )}
        <div className="min-w-0">
          <div className="truncate text-xs font-black text-slate-800">
            {status.label}
          </div>
          <div className="truncate text-[10px] font-semibold text-slate-400">
            {healthy
              ? `${status.count} items received`
              : status.configured
                ? status.error ?? "Unavailable"
                : "Optional setup required"}
          </div>
        </div>
      </div>
      <span
        className={[
          "rounded-full px-2 py-1 text-[10px] font-black",
          healthy
            ? "bg-emerald-50 text-emerald-700"
            : status.configured
              ? "bg-rose-50 text-rose-700"
              : "bg-amber-50 text-amber-700",
        ].join(" ")}
      >
        {healthy ? "LIVE" : status.configured ? "DOWN" : "SETUP"}
      </span>
    </div>
  );
}

export default function GlobalPulsePage() {
  const [topic, setTopic] = useState<PulseTopic>("all");
  const [hours, setHours] = useState(168);
  const [searchDraft, setSearchDraft] = useState("");
  const [countryDraft, setCountryDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [country, setCountry] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [payload, setPayload] = useState<PulseResponse>(EMPTY_RESPONSE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          topic,
          hours: String(hours),
          limit: "72",
        });
        if (searchQuery) params.set("q", searchQuery);
        if (country) params.set("country", country);
        if (refreshToken) params.set("refresh", String(refreshToken));

        const response = await fetch(`/api/global-pulse?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const json = (await response.json()) as PulseResponse;
        if (!response.ok) throw new Error(json.error || "Unable to load Global Pulse.");
        setPayload(json);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load Global Pulse.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [topic, hours, searchQuery, country, refreshToken]);

  const hero = payload.hero;
  const secondaryStories = useMemo(
    () => payload.items.filter((item) => item.id !== hero?.id).slice(0, 3),
    [payload.items, hero?.id],
  );
  const remainingStories = useMemo(
    () => payload.items.filter((item) => item.id !== hero?.id).slice(3),
    [payload.items, hero?.id],
  );

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchQuery(searchDraft.trim());
    setCountry(countryDraft.trim());
  }

  return (
    <main className="min-h-screen bg-slate-100 pb-16">
      <section className="border-b border-indigo-950/20 bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-900 text-white">
        <div className="mx-auto w-full max-w-[1480px] px-4 py-9 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-200 backdrop-blur">
                <Sparkles className="h-4 w-4" />
                Stratify Intelligence Feed
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-[-0.045em] text-white sm:text-5xl">
                Global Pulse
              </h1>
              <p className="mt-3 max-w-3xl text-[15px] font-medium leading-7 text-slate-200">
                News, official updates and historical context shaping the global
                geo-social economy — connected directly to Stratify data modules.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { icon: Database, label: "Stories", value: payload.counts.total },
                {
                  icon: Activity,
                  label: "Sources Live",
                  value: `${payload.counts.sourcesOk}/${payload.counts.sourcesTotal}`,
                },
                {
                  icon: ShieldCheck,
                  label: "Official",
                  value: payload.counts.official,
                },
                { icon: Clock3, label: "Window", value: hours === 24 ? "24h" : "7d" },
              ].map(({ icon: Icon, label, value }) => (
                <div
                  key={label}
                  className="min-w-[118px] rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur"
                >
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-slate-300">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </div>
                  <div className="mt-1 text-xl font-black text-white">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="sticky top-[72px] z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-xl">
        <div className="mx-auto w-full max-w-[1480px] px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {TOPICS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTopic(item.key)}
                className={[
                  "shrink-0 rounded-full px-3.5 py-2 text-xs font-black transition",
                  topic === item.key
                    ? "bg-gradient-to-r from-indigo-700 to-blue-700 text-white shadow-md shadow-indigo-200"
                    : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-white hover:text-indigo-700",
                ].join(" ")}
              >
                {item.label}
              </button>
            ))}
          </div>

          <form
            onSubmit={applySearch}
            className="mt-3 grid gap-2 lg:grid-cols-[minmax(260px,1fr)_220px_auto_auto]"
          >
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchDraft}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setSearchDraft(event.target.value)
                }
                placeholder="Search inflation, trade, energy, migration..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </label>

            <label className="relative block">
              <Globe2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={countryDraft}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setCountryDraft(event.target.value)
                }
                placeholder="Country e.g. Pakistan"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </label>

            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              {[24, 168].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setHours(value)}
                  className={[
                    "rounded-lg px-3 py-1.5 text-xs font-black",
                    hours === value
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-slate-500",
                  ].join(" ")}
                >
                  {value === 24 ? "24 hours" : "7 days"}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-indigo-700"
              >
                <Search className="h-4 w-4" />
                Apply
              </button>
              <button
                type="button"
                onClick={() => setRefreshToken(Date.now())}
                aria-label="Refresh Global Pulse"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8">
        {loading && !payload.items.length ? (
          <div className="flex min-h-[480px] flex-col items-center justify-center rounded-[28px] border border-slate-200 bg-white text-center shadow-sm">
            <Loader2 className="h-11 w-11 animate-spin text-indigo-700" />
            <div className="mt-4 text-xl font-black text-slate-950">
              Building your Global Pulse
            </div>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Fetching and ranking global news and official updates...
            </p>
          </div>
        ) : error ? (
          <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-8 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-rose-600" />
            <h2 className="mt-3 text-xl font-black text-rose-950">Global Pulse could not load</h2>
            <p className="mt-2 text-sm font-semibold text-rose-800">{error}</p>
            <button
              type="button"
              onClick={() => setRefreshToken(Date.now())}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-rose-700 px-4 py-2 text-sm font-black text-white"
            >
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
          </div>
        ) : (
          <>
            <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_330px]">
              <aside className="space-y-6">
                <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
                  <SectionHeader
                    icon={TrendingUp}
                    eyebrow="Signals"
                    title="Trending"
                    description="Ranked by story volume, authority and freshness."
                  />

                  <div className="space-y-2">
                    {payload.trending.length ? (
                      payload.trending.map((item, index) => (
                        <button
                          key={item.topic}
                          type="button"
                          onClick={() => setTopic(item.topic)}
                          className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-black text-indigo-700 shadow-sm">
                            {index + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-black text-slate-850">
                              {item.label}
                            </span>
                            <span className="mt-0.5 block text-[11px] font-semibold text-slate-500">
                              {item.count} related reports
                            </span>
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="rounded-2xl bg-slate-50 p-4 text-xs font-semibold text-slate-500">
                        No trending signals matched the current filters.
                      </p>
                    )}
                  </div>
                </section>

                <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
                  <SectionHeader
                    icon={Database}
                    eyebrow="Diagnostics"
                    title="Source Health"
                  />
                  <div className="space-y-2">
                    {payload.sourceStatus.map((status) => (
                      <SourceHealth key={status.id} status={status} />
                    ))}
                  </div>
                </section>
              </aside>

              <section className="min-w-0">
                {hero ? (
                  <HeroStory item={hero} />
                ) : (
                  <div className="flex min-h-[430px] items-center justify-center rounded-[30px] border border-dashed border-slate-300 bg-white text-center">
                    <div className="max-w-sm p-8">
                      <Newspaper className="mx-auto h-10 w-10 text-slate-400" />
                      <h2 className="mt-3 text-xl font-black text-slate-950">
                        No matching stories
                      </h2>
                      <p className="mt-2 text-sm font-medium text-slate-500">
                        Clear the search or choose a broader category.
                      </p>
                    </div>
                  </div>
                )}

                {secondaryStories.length ? (
                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    {secondaryStories.map((item) => (
                      <StoryCard key={item.id} item={item} compact />
                    ))}
                  </div>
                ) : null}
              </section>

              <aside className="space-y-6">
                <section className="rounded-[26px] border border-violet-200 bg-white p-5 shadow-sm">
                  <SectionHeader
                    icon={BookOpen}
                    eyebrow="Wikipedia"
                    title="Today in History"
                    description="Daily context from Wikipedia's On This Day feed."
                  />
                  <div className="space-y-3">
                    {payload.todayInHistory.slice(0, 4).map((item) => (
                      <HistoryCard key={item.id} item={item} />
                    ))}
                  </div>
                  <Link
                    href="/history"
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-violet-800"
                  >
                    Open History Module
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </section>

                <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
                  <SectionHeader
                    icon={Landmark}
                    eyebrow="Primary Sources"
                    title="Official Updates"
                    description="Latest updates from multilateral institutions."
                  />
                  <div className="divide-y divide-slate-100">
                    {payload.officialUpdates.slice(0, 6).map((item) => (
                      <article key={item.id} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-700">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {item.source}
                        </div>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1.5 block text-sm font-black leading-5 text-slate-900 hover:text-indigo-700"
                        >
                          {item.title}
                        </a>
                        <div className="mt-1 text-[11px] font-semibold text-slate-400">
                          {formatRelative(item.publishedAt)}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              </aside>
            </div>

            {remainingStories.length ? (
              <section className="mt-8">
                <SectionHeader
                  icon={Newspaper}
                  eyebrow="Global Coverage"
                  title="Latest Intelligence"
                  description="Deduplicated reports ranked by recency, authority and relevance."
                />
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                  {remainingStories.map((item) => (
                    <StoryCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            ) : null}

            <section className="mt-8 overflow-hidden rounded-[30px] border border-indigo-900/20 bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-950 p-6 text-white shadow-xl sm:p-8">
              <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-300">
                    <Zap className="h-4 w-4" />
                    News connected to data
                  </div>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                    Move from headlines to evidence.
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-300">
                    Every story is classified and linked to the relevant Stratify module,
                    helping users examine the underlying monetary, energy, food,
                    historical, country and corporate data.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ["Energy", "/energy", Zap],
                    ["Monetary", "/monetary", Building2],
                    ["FAOSTAT", "/faostat", Wheat],
                    ["History", "/history", History],
                    ["World Data", "/world", Globe2],
                  ].map(([label, href, Icon]) => {
                    const ModuleIcon = Icon as typeof Globe2;
                    return (
                      <Link
                        key={String(label)}
                        href={String(href)}
                        className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-black text-white transition hover:bg-white/20"
                      >
                        <ModuleIcon className="h-4 w-4" />
                        {String(label)}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </section>

            {payload.warnings.length ? (
              <details className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <summary className="cursor-pointer text-sm font-black text-amber-900">
                  {payload.warnings.length} source warning
                  {payload.warnings.length === 1 ? "" : "s"}
                </summary>
                <ul className="mt-3 space-y-1 text-xs font-semibold text-amber-800">
                  {payload.warnings.map((warning) => (
                    <li key={warning}>• {warning}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
