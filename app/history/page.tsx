"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Globe2,
  Landmark,
  Loader2,
  ScrollText,
  ShieldAlert,
  Swords,
} from "lucide-react";

import EventDetailDialog from "@/app/history/components/EventDetailDialog";

type HistoryTab =
  | "conflicts"
  | "battles"
  | "revolutions"
  | "empires"
  | "civilizations"
  | "on-this-day";

type HistoryEvent = {
  qid: string;
  title: string;
  description: string | null;
  type: string;
  year: number | null;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  modernCountry: string | null;
  modernIso3: string | null;
  modernCountries?: Array<{ iso3: string; country: string }>;
  participants?: string[];
  outcomes?: string[];
  lat: number | null;
  lng: number | null;
  articleUrl: string | null;
  confidence: "high" | "medium" | "low";
};

type CountryRow = {
  iso3: string;
  country: string;
  value: number;
};

type EventsResponse = {
  ok?: boolean;
  tab?: string;
  label?: string;
  note?: string;
  from?: number;
  to?: number;
  events?: HistoryEvent[];
  countryRows?: CountryRow[];
  total?: number;
  mappedCountries?: number;
  source?: string;
  queryMode?: string;
  detailWarning?: string | null;
  error?: string;
};

type OnThisDayItem = {
  id: string;
  kind: string;
  year: number | null;
  text: string;
  title: string;
  description: string;
  articleUrl: string | null;
  thumbnailUrl: string | null;
};

type OnThisDayResponse = {
  ok?: boolean;
  month?: number;
  day?: number;
  selected?: OnThisDayItem[];
  events?: OnThisDayItem[];
  births?: OnThisDayItem[];
  deaths?: OnThisDayItem[];
  holidays?: OnThisDayItem[];
  source?: string;
  error?: string;
};

const TABS: Array<{
  key: HistoryTab;
  label: string;
  short: string;
  icon: any;
  from: number;
  to: number;
}> = [
  {
    key: "conflicts",
    label: "Wars & Conflicts",
    short: "Wars, conflicts and civil wars",
    icon: Swords,
    from: 401,
    to: 2026,
  },
  {
    key: "battles",
    label: "Battles & Sieges",
    short: "Battle and siege-level events",
    icon: ShieldAlert,
    from: -500,
    to: 2026,
  },
  {
    key: "revolutions",
    label: "Independence & Revolutions",
    short: "Revolutions, coups and independence events",
    icon: Landmark,
    from: 1701,
    to: 2026,
  },
  {
    key: "empires",
    label: "Empires & Kingdoms",
    short: "Historic states, empires and kingdoms",
    icon: Globe2,
    from: -500,
    to: 2026,
  },
  {
    key: "civilizations",
    label: "Empires & Civilizations",
    short: "Ancient civilizations and historical entities",
    icon: ScrollText,
    from: -4000,
    to: 1600,
  },
  {
    key: "on-this-day",
    label: "On This Day",
    short: "Daily historical events from Wikipedia",
    icon: CalendarDays,
    from: 0,
    to: 0,
  },
];

function cleanText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\uFEFF/g, "")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function fmtNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-US").format(value);
}

function fmtYear(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Unknown";
  }

  if (value < 0) return `${Math.abs(value)} BC`;
  return `${value}`;
}

function ordinal(value: number) {
  const n = Math.abs(value);
  const mod10 = n % 10;
  const mod100 = n % 100;

  if (mod10 === 1 && mod100 !== 11) return `${n}st`;
  if (mod10 === 2 && mod100 !== 12) return `${n}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${n}rd`;

  return `${n}th`;
}

function getCenturyRange(century: number) {
  if (century > 0) {
    const from = (century - 1) * 100 + 1;
    const to = century === 21 ? 2026 : century * 100;
    return { from, to };
  }

  const abs = Math.abs(century);

  return {
    from: -abs * 100,
    to: -(abs - 1) * 100 - 1,
  };
}

function getCenturyFromYear(year: number) {
  if (year > 0) return Math.floor((year - 1) / 100) + 1;
  return -Math.ceil(Math.abs(year) / 100);
}

function getCenturyLabel(century: number) {
  const range = getCenturyRange(century);

  if (century > 0) {
    return `${ordinal(century)} century (${range.from}–${range.to})`;
  }

  return `${ordinal(Math.abs(century))} century BC (${Math.abs(
    range.from,
  )}–${Math.abs(range.to)} BC)`;
}

const CENTURY_OPTIONS = Array.from({ length: 61 }, (_, index) => -40 + index)
  .filter((century) => century !== 0 && century <= 21)
  .map((century) => ({
    value: String(century),
    label: getCenturyLabel(century),
    ...getCenturyRange(century),
  }));

function getDefaultCenturyForTab(tabKey: HistoryTab) {
  const tab = TABS.find((item) => item.key === tabKey) || TABS[0];
  if (tab.key === "on-this-day") return "custom";

  const century = getCenturyFromYear(tab.from);
  return String(century);
}

function getTodayParts() {
  const now = new Date();

  return {
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

function confidenceClass(value: HistoryEvent["confidence"]) {
  if (value === "high") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (value === "medium") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function getUsefulYears(events: HistoryEvent[]) {
  return events
    .map((event) => event.year)
    .filter((year): year is number => typeof year === "number");
}

function getTypeRows(events: HistoryEvent[]) {
  const map = new Map<string, number>();

  for (const event of events) {
    const key = cleanText(event.type || "Historical event") || "Historical event";
    map.set(key, (map.get(key) || 0) + 1);
  }

  return Array.from(map.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

function getTimelineBuckets(events: HistoryEvent[]) {
  const years = getUsefulYears(events);
  if (!years.length) return [];

  const min = Math.min(...years);
  const max = Math.max(...years);
  const span = Math.max(1, max - min + 1);
  const bucketCount = Math.min(8, Math.max(3, Math.ceil(span / 25)));
  const bucketSize = Math.max(1, Math.ceil(span / bucketCount));

  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const from = min + index * bucketSize;
    const to = Math.min(max, from + bucketSize - 1);

    return {
      from,
      to,
      count: 0,
    };
  });

  for (const year of years) {
    const index = Math.min(
      buckets.length - 1,
      Math.max(0, Math.floor((year - min) / bucketSize)),
    );

    buckets[index].count += 1;
  }

  const maxCount = Math.max(...buckets.map((bucket) => bucket.count), 1);

  return buckets.map((bucket) => ({
    ...bucket,
    pct: Math.max(8, Math.round((bucket.count / maxCount) * 100)),
  }));
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </div>

      <div className="mt-2 text-2xl font-black tracking-tight text-slate-950">
        {value}
      </div>

      <div className="mt-1 text-xs font-semibold text-slate-500">{helper}</div>
    </div>
  );
}

function OnThisDaySection({
  title,
  items,
}: {
  title: string;
  items: OnThisDayItem[];
}) {
  if (!items.length) return null;

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-base font-black text-slate-950">{title}</h3>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {items.slice(0, 12).map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
          >
            <div className="flex gap-3">
              {item.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.thumbnailUrl}
                  alt={item.title || title}
                  className="h-16 w-20 shrink-0 rounded-xl object-cover"
                />
              ) : null}

              <div className="min-w-0 flex-1">
                <div className="text-xs font-black uppercase tracking-wide text-violet-700">
                  {item.year ? fmtYear(item.year) : item.kind}
                </div>

                <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">
                  {item.text}
                </p>

                {item.articleUrl ? (
                  <a
                    href={item.articleUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-black text-slate-950 hover:underline"
                  >
                    Read more
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function HistoryPage() {
  const today = useMemo(() => getTodayParts(), []);

  const defaultCentury = getDefaultCenturyForTab("conflicts");
  const defaultRange =
    CENTURY_OPTIONS.find((item) => item.value === defaultCentury) ||
    getCenturyRange(5);

  const [activeTab, setActiveTab] = useState<HistoryTab>("conflicts");
  const [detailQid, setDetailQid] = useState<string | null>(null);
  const [fromYear, setFromYear] = useState(defaultRange.from);
  const [toYear, setToYear] = useState(defaultRange.to);
  const [centuryValue, setCenturyValue] = useState(defaultCentury);
  const [limit, setLimit] = useState(50);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [eventsPayload, setEventsPayload] = useState<EventsResponse | null>(
    null,
  );
  const [selectedEvent, setSelectedEvent] = useState<HistoryEvent | null>(null);

  const [month, setMonth] = useState(today.month);
  const [day, setDay] = useState(today.day);
  const [onThisDay, setOnThisDay] = useState<OnThisDayResponse | null>(null);

  const activeMeta = useMemo(
    () => TABS.find((tab) => tab.key === activeTab) || TABS[0],
    [activeTab],
  );

  const isOnThisDay = activeTab === "on-this-day";
  const events = eventsPayload?.events || [];
  const years = getUsefulYears(events);
  const earliestYear = years.length ? Math.min(...years) : null;
  const latestYear = years.length ? Math.max(...years) : null;
  const typeRows = getTypeRows(events);
  const timelineBuckets = getTimelineBuckets(events);

  function handleCenturyChange(value: string) {
    setCenturyValue(value);

    if (value === "custom") return;

    const option = CENTURY_OPTIONS.find((item) => item.value === value);
    if (!option) return;

    setFromYear(option.from);
    setToYear(option.to);
  }

  useEffect(() => {
    const tab = TABS.find((item) => item.key === activeTab);
    if (!tab || activeTab === "on-this-day") return;

    const nextCentury = getDefaultCenturyForTab(activeTab);
    const nextRange =
      CENTURY_OPTIONS.find((item) => item.value === nextCentury) ||
      getCenturyRange(getCenturyFromYear(tab.from));

    setFromYear(nextRange.from);
    setToYear(nextRange.to);
    setCenturyValue(nextCentury);
    setSelectedEvent(null);
  }, [activeTab]);

  useEffect(() => {
    if (isOnThisDay) return;

    const controller = new AbortController();

    async function loadEvents() {
      try {
        setLoading(true);
        setError("");
        setSelectedEvent(null);

        const qs = new URLSearchParams();
        qs.set("tab", activeTab);
        qs.set("from", String(fromYear));
        qs.set("to", String(toYear));
        qs.set("limit", String(limit));

        const response = await fetch(`/api/history/events?${qs.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        const json = (await response.json()) as EventsResponse;

        if (!response.ok || json.ok === false) {
          throw new Error(json.error || "Failed to load history events");
        }

        if (!controller.signal.aborted) {
          const sorted = (json.events || []).slice().sort((a, b) => {
            const ay = a.year ?? 999999;
            const by = b.year ?? 999999;
            if (ay !== by) return ay - by;
            return a.title.localeCompare(b.title);
          });

          const nextPayload = {
            ...json,
            events: sorted,
            total: sorted.length,
          };

          setEventsPayload(nextPayload);
          setSelectedEvent(sorted[0] || null);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error ? err.message : "Failed to load history events",
          );
          setEventsPayload(null);
          setSelectedEvent(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadEvents();

    return () => controller.abort();
  }, [activeTab, fromYear, toYear, limit, isOnThisDay]);

  useEffect(() => {
    if (!isOnThisDay) return;

    const controller = new AbortController();

    async function loadOnThisDay() {
      try {
        setLoading(true);
        setError("");

        const qs = new URLSearchParams();
        qs.set("month", String(month));
        qs.set("day", String(day));

        const response = await fetch(
          `/api/history/on-this-day?${qs.toString()}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const json = (await response.json()) as OnThisDayResponse;

        if (!response.ok || json.ok === false) {
          throw new Error(json.error || "Failed to load On This Day");
        }

        if (!controller.signal.aborted) {
          setOnThisDay(json);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error ? err.message : "Failed to load On This Day",
          );
          setOnThisDay(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadOnThisDay();

    return () => controller.abort();
  }, [isOnThisDay, month, day]);

  return (
    <main className="min-h-screen bg-[#eef3fb] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1480px] space-y-5">
        <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.3em] text-violet-700">
                Stratify History Intelligence
              </div>

              <h1 className="mt-2 text-[30px] font-black tracking-tight text-slate-950 md:text-[38px]">
                Explore history through time, events and eras
              </h1>

              <p className="mt-2 max-w-4xl text-sm font-medium leading-6 text-slate-500">
                Browse historical events by century. The page now focuses on
                event intelligence, timeline spread, event types and source
                detail instead of weak modern-country mapping.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                label="Current tab"
                value={activeMeta.label}
                helper={activeMeta.short}
              />

              <StatCard
                label="Events"
                value={
                  isOnThisDay
                    ? fmtNumber(
                        (onThisDay?.selected?.length || 0) +
                          (onThisDay?.events?.length || 0),
                      )
                    : fmtNumber(eventsPayload?.total || 0)
                }
                helper={isOnThisDay ? "Daily entries" : "Unique events"}
              />

              <StatCard
                label="Era range"
                value={
                  isOnThisDay
                    ? "Daily"
                    : `${fmtYear(earliestYear)} → ${fmtYear(latestYear)}`
                }
                helper={isOnThisDay ? "Wikipedia feed" : "Returned timeline"}
              />
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={[
                    "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-black transition",
                    active
                      ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
          {isOnThisDay ? (
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-950">
                  On This Day
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Select a month and day to fetch historical events, births,
                  deaths and holidays from Wikipedia.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Month
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={month}
                    onChange={(event) => setMonth(Number(event.target.value))}
                    className="mt-1 block h-10 w-24 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:border-violet-400"
                  />
                </label>

                <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Day
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={day}
                    onChange={(event) => setDay(Number(event.target.value))}
                    className="mt-1 block h-10 w-24 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:border-violet-400"
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-950">
                  {activeMeta.label}
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  {activeMeta.short}. Select a century or use custom year range.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Century
                  <select
                    value={centuryValue}
                    onChange={(event) => handleCenturyChange(event.target.value)}
                    className="mt-1 block h-10 w-64 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-violet-400"
                  >
                    <option value="custom">Custom range</option>
                    {CENTURY_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                  From year
                  <input
                    type="number"
                    value={fromYear}
                    onChange={(event) => {
                      setCenturyValue("custom");
                      setFromYear(Number(event.target.value));
                    }}
                    className="mt-1 block h-10 w-32 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:border-violet-400"
                  />
                </label>

                <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                  To year
                  <input
                    type="number"
                    value={toYear}
                    onChange={(event) => {
                      setCenturyValue("custom");
                      setToYear(Number(event.target.value));
                    }}
                    className="mt-1 block h-10 w-32 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:border-violet-400"
                  />
                </label>

                <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Limit
                  <select
                    value={limit}
                    onChange={(event) => setLimit(Number(event.target.value))}
                    className="mt-1 block h-10 w-32 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-violet-400"
                  >
                    {[10, 25, 50, 80].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          )}
        </section>

        {error ? (
          <section className="rounded-[24px] border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
            {error}
          </section>
        ) : null}

        {loading ? (
          <section className="flex min-h-[360px] items-center justify-center rounded-[32px] border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col items-center">
              <Loader2 className="h-10 w-10 animate-spin text-slate-950" />
              <div className="mt-3 text-sm font-black text-slate-900">
                Loading history intelligence...
              </div>
              <div className="mt-1 text-xs font-semibold text-slate-500">
                Fetching structured history data
              </div>
            </div>
          </section>
        ) : isOnThisDay ? (
          <div className="space-y-4">
            <OnThisDaySection
              title="Selected highlights"
              items={onThisDay?.selected || []}
            />
            <OnThisDaySection title="Events" items={onThisDay?.events || []} />
            <OnThisDaySection title="Births" items={onThisDay?.births || []} />
            <OnThisDaySection title="Deaths" items={onThisDay?.deaths || []} />
            <OnThisDaySection
              title="Holidays and observances"
              items={onThisDay?.holidays || []}
            />
          </div>
        ) : (
          <section className="grid gap-5 xl:grid-cols-[minmax(420px,0.75fr)_minmax(620px,1.25fr)]">
            <aside className="space-y-5">
              <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-violet-700">
                  Era intelligence
                </div>

                <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                  {activeMeta.label}
                </h2>

                <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                  {fmtYear(fromYear)} to {fmtYear(toYear)} ·{" "}
                  {fmtNumber(events.length)} unique events returned.
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                      Earliest
                    </div>
                    <div className="mt-1 text-lg font-black text-slate-950">
                      {fmtYear(earliestYear)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                      Latest
                    </div>
                    <div className="mt-1 text-lg font-black text-slate-950">
                      {fmtYear(latestYear)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                      Source
                    </div>
                    <div className="mt-1 text-sm font-black text-slate-950">
                      Wikidata / Wikipedia
                    </div>
                  </div>
                </div>
              </section>

              {selectedEvent ? (
                <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-violet-700">
                    Selected event
                  </div>

                  <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                    {selectedEvent.title}
                  </h3>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">
                      {fmtYear(selectedEvent.year)}
                    </span>

                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600">
                      {selectedEvent.type}
                    </span>

                    <span
                      className={[
                        "rounded-full border px-3 py-1 text-xs font-black capitalize",
                        confidenceClass(selectedEvent.confidence),
                      ].join(" ")}
                    >
                      {selectedEvent.confidence}
                    </span>
                  </div>

                  {selectedEvent.description ? (
                    <p className="mt-3 text-sm font-medium leading-6 text-slate-500">
                      {selectedEvent.description}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setDetailQid(selectedEvent.qid)}
                    className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-800"
                  >
                    Open detail
                    <ArrowUpRight className="h-4 w-4" />
                  </button>
                </section>
              ) : null}

              <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-black text-slate-950">
                  Timeline spread
                </h3>

                <div className="mt-4 space-y-3">
                  {timelineBuckets.map((bucket) => (
                    <div key={`${bucket.from}-${bucket.to}`}>
                      <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-500">
                        <span>
                          {fmtYear(bucket.from)}–{fmtYear(bucket.to)}
                        </span>
                        <span>{bucket.count}</span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-slate-950"
                          style={{ width: `${bucket.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}

                  {!timelineBuckets.length ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                      No timeline distribution available.
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-black text-slate-950">
                  Event type mix
                </h3>

                <div className="mt-4 flex flex-wrap gap-2">
                  {typeRows.map((row) => (
                    <span
                      key={row.type}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-700"
                    >
                      {row.type} · {row.count}
                    </span>
                  ))}

                  {!typeRows.length ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                      No event types returned.
                    </div>
                  ) : null}
                </div>
              </section>
            </aside>

            <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 className="text-xl font-black text-slate-950">
                    Event table
                  </h2>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Ascending timeline · {fmtNumber(events.length)} unique
                    events
                  </p>
                </div>

                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
                  <Clock3 className="h-4 w-4 text-violet-700" />
                  QID deduped
                </div>
              </div>

              <div className="max-h-[820px] overflow-auto">
                <table className="w-full min-w-[650px] text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-950 text-white">
                    <tr>
                      <th className="w-[95px] px-4 py-3 text-left text-xs font-black uppercase tracking-wide">
                        Timeline
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide">
                        Conflict / event
                      </th>
                      <th className="w-[110px] px-4 py-3 text-left text-xs font-black uppercase tracking-wide">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {events.map((event) => {
                      const active = selectedEvent?.qid === event.qid;

                      return (
                        <tr
                          key={event.qid}
                          onClick={() => setSelectedEvent(event)}
                          className={[
                            "cursor-pointer border-t transition",
                            active
                              ? "bg-violet-50"
                              : "bg-white hover:bg-slate-50",
                          ].join(" ")}
                        >
                          <td className="px-4 py-3 align-top">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">
                              {fmtYear(event.year)}
                            </span>
                          </td>

                          <td className="px-4 py-3 align-top">
                            <div className="font-black leading-5 text-slate-950">
                              {event.title}
                            </div>

                            <div className="mt-1 flex flex-wrap gap-2">
                              <span className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                                {event.type}
                              </span>
                              <span
                                className={[
                                  "rounded-full border px-2 py-0.5 text-[10px] font-black capitalize",
                                  confidenceClass(event.confidence),
                                ].join(" ")}
                              >
                                {event.confidence}
                              </span>
                            </div>

                            {event.description ? (
                              <div className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-slate-500">
                                {event.description}
                              </div>
                            ) : null}
                          </td>

                          <td className="px-4 py-3 align-top">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailQid(event.qid);
                              }}
                              className="inline-flex items-center gap-1 rounded-full bg-slate-950 px-3 py-1.5 text-xs font-black text-white transition hover:bg-slate-800"
                            >
                              Open
                              <ArrowUpRight className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {!events.length ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-4 py-8 text-center text-sm font-semibold text-slate-500"
                        >
                          No events returned. Try another century or a wider
                          custom range.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        )}

        <EventDetailDialog qid={detailQid} onClose={() => setDetailQid(null)} />
      </div>
    </main>
  );
}
