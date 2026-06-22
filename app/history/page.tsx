"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  Clock3,
  Landmark,
  Loader2,
  Search,
  ScrollText,
  ShieldAlert,
  Swords,
  X,
} from "lucide-react";

import EventDetailDialog from "@/app/history/components/EventDetailDialog";

type SegmentKey =
  | "wars"
  | "battles"
  | "revolutions"
  | "empires"
  | "civilizations";

type SourceItem = {
  key: string;
  label: string;
};

type HistoryRecord = {
  qid?: string | null;
  title: string;
  description: string | null;
  type: string;
  year: number | null;
  startYear: number | null;
  endYear: number | null;
  articleUrl: string | null;
  source: string;
};

type Bucket = {
  bucket: number;
  from: number;
  to: number;
  label: string;
  count: number;
  pct: number;
};

type RecordsPayload = {
  ok?: boolean;
  segment?: SegmentKey;
  label?: string;
  sourceKey?: string;
  sourceLabel?: string;
  sourceTitle?: string;
  page?: number;
  pageSize?: number;
  events?: HistoryRecord[];
  total?: number;
  hasMore?: boolean;
  buckets?: Bucket[];
  activeRange?: {
    from: number;
    to: number;
  } | null;
  warning?: string | null;
};

type ActiveRange = {
  from: number;
  to: number;
  label: string;
} | null;

const SEGMENTS: Array<{
  key: SegmentKey;
  label: string;
  helper: string;
  icon: any;
  sources: SourceItem[];
}> = [
  {
    key: "wars",
    label: "Wars & Conflicts",
    helper: "Conflict records from Wikipedia war-list indexes",
    icon: Swords,
    sources: [
      { key: "wars-before-1000", label: "Before 1000" },
      { key: "wars-1000-1499", label: "1000–1499" },
      { key: "wars-1500-1799", label: "1500–1799" },
      { key: "wars-1800-1899", label: "1800–1899" },
      { key: "wars-1900-1944", label: "1900–1944" },
      { key: "wars-1945-1989", label: "1945–1989" },
      { key: "wars-1990-2002", label: "1990–2002" },
      { key: "wars-2003-2019", label: "2003–2019" },
      { key: "wars-2020-present", label: "2020–present" },
    ],
  },
  {
    key: "battles",
    label: "Battles & Sieges",
    helper: "Battle and siege records by era",
    icon: ShieldAlert,
    sources: [
      { key: "battles-before-301", label: "Before 301" },
      { key: "battles-301-1300", label: "301–1300" },
      { key: "battles-1301-1600", label: "1301–1600" },
      { key: "battles-1601-1800", label: "1601–1800" },
      { key: "battles-1801-1900", label: "1801–1900" },
      { key: "battles-1901-2000", label: "1901–2000" },
      { key: "battles-since-2001", label: "Since 2001" },
    ],
  },
  {
    key: "revolutions",
    label: "Independence & Revolutions",
    helper: "Revolutions, coups and independence movement indexes",
    icon: Landmark,
    sources: [
      { key: "revolutions-rebellions", label: "Revolutions & rebellions" },
      { key: "coups", label: "Coups" },
      { key: "independence", label: "Independence movements" },
    ],
  },
  {
    key: "empires",
    label: "Empires & Kingdoms",
    helper: "Empire and kingdom reference indexes",
    icon: Building2,
    sources: [
      { key: "empires-list", label: "Empires" },
      { key: "largest-empires", label: "Largest empires" },
    ],
  },
  {
    key: "civilizations",
    label: "Empires & Civilizations",
    helper: "Civilization and historical-entity indexes",
    icon: ScrollText,
    sources: [
      { key: "ancient-civilizations", label: "Ancient civilizations" },
      { key: "bronze-age-states", label: "Bronze Age states" },
      { key: "iron-age-states", label: "Iron Age states" },
      { key: "classical-age-states", label: "Classical Age states" },
    ],
  },
];

function fmtNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US").format(value);
}

function fmtYear(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Unknown";
  if (value < 0) return `${Math.abs(value)} BC`;
  return String(value);
}

function fmtTimeline(record: HistoryRecord) {
  const start = record.startYear ?? record.year;
  const end = record.endYear;

  if (start === null || start === undefined) return "Unknown";
  if (end !== null && end !== undefined && end !== start) return `${fmtYear(start)}–${fmtYear(end)}`;

  return fmtYear(start);
}

function FrequencyPanel({
  loading,
  buckets,
  total,
  activeRange,
  onBucketClick,
  onClearRange,
}: {
  loading: boolean;
  buckets: Bucket[];
  total: number;
  activeRange: ActiveRange;
  onBucketClick: (bucket: Bucket) => void;
  onClearRange: () => void;
}) {
  return (
    <aside className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.22em] text-violet-700">
            Frequency
          </div>
          <h3 className="mt-1 text-lg font-black text-slate-950">
            Records by century
          </h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Click a century to filter the event table.
          </p>
        </div>
        <BarChart3 className="h-5 w-5 text-violet-700" />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">
            Active timeframe
          </div>
          <div className="truncate text-xs font-black text-slate-800">
            {activeRange ? activeRange.label : "All centuries"}
          </div>
        </div>

        {activeRange ? (
          <button
            type="button"
            onClick={onClearRange}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2 py-1 text-[11px] font-black text-slate-600 shadow-sm hover:text-rose-600"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        ) : null}
      </div>

      <div className="mt-4 max-h-[610px] space-y-3 overflow-auto pr-1">
        {loading ? (
          <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
            <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
          </div>
        ) : buckets.length ? (
          buckets.map((bucket) => {
            const active =
              activeRange?.from === bucket.from && activeRange?.to === bucket.to;

            return (
              <button
                key={`${bucket.from}-${bucket.to}`}
                type="button"
                onClick={() => onBucketClick(bucket)}
                className={[
                  "block w-full rounded-2xl border p-2 text-left transition",
                  active
                    ? "border-violet-300 bg-violet-50 shadow-sm"
                    : "border-transparent hover:border-slate-200 hover:bg-slate-50",
                ].join(" ")}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] font-black text-slate-700">
                    {bucket.label}
                  </span>
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-[11px] font-black",
                      active
                        ? "bg-violet-600 text-white"
                        : "bg-slate-100 text-slate-700",
                    ].join(" ")}
                  >
                    {bucket.count}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={[
                      "h-full rounded-full",
                      active ? "bg-slate-950" : "bg-violet-600",
                    ].join(" ")}
                    style={{ width: `${bucket.pct}%` }}
                  />
                </div>
              </button>
            );
          })
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
            No frequency data for this source.
          </div>
        )}
      </div>
    </aside>
  );
}

export default function HistoryPage() {
  const [activeSegment, setActiveSegment] = useState<SegmentKey>("wars");
  const [activeSourceKey, setActiveSourceKey] = useState("wars-1900-1944");
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [activeRange, setActiveRange] = useState<ActiveRange>(null);
  const [fromYearText, setFromYearText] = useState("");
  const [toYearText, setToYearText] = useState("");

  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<RecordsPayload | null>(null);

  const [detailQid, setDetailQid] = useState<string | null>(null);
  const [detailArticleUrl, setDetailArticleUrl] = useState<string | null>(null);
  const [detailFallbackTitle, setDetailFallbackTitle] = useState<string | null>(null);

  const activeMeta = useMemo(
    () => SEGMENTS.find((item) => item.key === activeSegment) || SEGMENTS[0],
    [activeSegment],
  );

  const activeSource =
    activeMeta.sources.find((source) => source.key === activeSourceKey) ||
    activeMeta.sources[0];

  const rows = payload?.events || [];
  const buckets = payload?.buckets || [];
  const total = payload?.total || 0;
  const hasMore = Boolean(payload?.hasMore);
  const startRow = rows.length ? (page - 1) * pageSize + 1 : 0;
  const endRow = rows.length ? startRow + rows.length - 1 : 0;

  function resetPaging() {
    setPage(1);
  }

  function openDetail(record: HistoryRecord) {
    setDetailQid(record.qid || null);
    setDetailArticleUrl(record.articleUrl || null);
    setDetailFallbackTitle(record.title || null);
  }

  function clearRange() {
    setActiveRange(null);
    setFromYearText("");
    setToYearText("");
    resetPaging();
  }

  function applyBucket(bucket: Bucket) {
    setActiveRange({
      from: bucket.from,
      to: bucket.to,
      label: bucket.label,
    });
    setFromYearText(String(bucket.from));
    setToYearText(String(bucket.to));
    resetPaging();
  }

  function applyCustomRange() {
    const from = Number(fromYearText);
    const to = Number(toYearText);

    if (!Number.isFinite(from) || !Number.isFinite(to)) return;

    const start = Math.trunc(Math.min(from, to));
    const end = Math.trunc(Math.max(from, to));

    setActiveRange({
      from: start,
      to: end,
      label: `${fmtYear(start)}-${fmtYear(end)}`,
    });

    setFromYearText(String(start));
    setToYearText(String(end));
    resetPaging();
  }

  useEffect(() => {
    const controller = new AbortController();

    async function loadRecords() {
      setLoading(true);

      try {
        const qs = new URLSearchParams();
        qs.set("segment", activeSegment);
        qs.set("sourceKey", activeSource.key);
        qs.set("page", String(page));
        qs.set("pageSize", String(pageSize));
        if (searchText.trim()) qs.set("q", searchText.trim());
        if (activeRange) {
          qs.set("from", String(activeRange.from));
          qs.set("to", String(activeRange.to));
        }

        const response = await fetch(`/api/history/source-records?${qs.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        const raw = await response.text();

        let json: RecordsPayload;
        try {
          json = JSON.parse(raw) as RecordsPayload;
        } catch {
          json = {
            ok: true,
            events: [],
            total: 0,
            hasMore: false,
            buckets: [],
            warning: "Source returned an invalid response.",
          };
        }

        if (!controller.signal.aborted) {
          setPayload(json);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadRecords();

    return () => controller.abort();
  }, [activeSegment, activeSource.key, page, pageSize, searchText, activeRange]);

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
                Multi-tab historical event intelligence
              </h1>
              <p className="mt-2 max-w-4xl text-sm font-medium leading-6 text-slate-500">
                Each segment loads only its selected source index. Click the frequency bars to apply a century-level timeframe to the event table.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">Active tab</div>
                <div className="mt-2 text-2xl font-black text-slate-950">{loading ? "Loading..." : activeMeta.label}</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">{activeMeta.helper}</div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">Records</div>
                <div className="mt-2 text-2xl font-black text-slate-950">{loading ? "Loading..." : fmtNumber(total)}</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">{activeRange ? activeRange.label : "Filtered source records"}</div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">Source index</div>
                <div className="mt-2 text-2xl font-black text-slate-950">{activeSource.label}</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">Single-source lazy fetch</div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {SEGMENTS.map((segment) => {
              const Icon = segment.icon;
              const active = activeSegment === segment.key;

              return (
                <button
                  key={segment.key}
                  type="button"
                  onClick={() => {
                    setActiveSegment(segment.key);
                    setActiveSourceKey(segment.sources[0].key);
                    setSearchText("");
                    setActiveRange(null);
                    setFromYearText("");
                    setToYearText("");
                    resetPaging();
                  }}
                  className={[
                    "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-black transition",
                    active
                      ? "border-violet-600 bg-violet-600 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                  {segment.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-950">{activeMeta.label}</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Select a source index, edit the year range manually, or click a frequency bar to filter by century.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                Source
                <select
                  value={activeSource.key}
                  onChange={(event) => {
                    setActiveSourceKey(event.target.value);
                    setSearchText("");
                    setActiveRange(null);
                    setFromYearText("");
                    setToYearText("");
                    resetPaging();
                  }}
                  className="mt-1 block h-10 w-64 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-violet-400"
                >
                  {activeMeta.sources.map((source) => (
                    <option key={source.key} value={source.key}>
                      {source.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                From year
                <input
                  type="number"
                  value={fromYearText}
                  onChange={(event) => setFromYearText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") applyCustomRange();
                  }}
                  placeholder="1901"
                  className="mt-1 block h-10 w-28 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-violet-400"
                />
              </label>

              <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                To year
                <input
                  type="number"
                  value={toYearText}
                  onChange={(event) => setToYearText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") applyCustomRange();
                  }}
                  placeholder="2000"
                  className="mt-1 block h-10 w-28 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-violet-400"
                />
              </label>

              <button
                type="button"
                onClick={applyCustomRange}
                className="mt-5 inline-flex h-10 items-center rounded-xl bg-slate-950 px-4 text-xs font-black text-white shadow-sm transition hover:bg-slate-800"
              >
                Apply time-frame
              </button>

              {activeRange ? (
                <button
                  type="button"
                  onClick={clearRange}
                  className="mt-5 inline-flex h-10 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:text-rose-600"
                >
                  <X className="h-4 w-4" />
                  Clear
                </button>
              ) : null}

              <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                Search
                <div className="mt-1 flex h-10 w-72 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-violet-400">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    value={searchText}
                    onChange={(event) => {
                      setSearchText(event.target.value);
                      resetPaging();
                    }}
                    placeholder="Search record, year, type..."
                    className="h-full min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none placeholder:text-slate-400"
                  />
                </div>
              </label>

              <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                Rows
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    resetPaging();
                  }}
                  className="mt-1 block h-10 w-28 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-violet-400"
                >
                  {[10, 25, 50].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </section>

        {payload?.warning ? (
          <section className="rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            {payload.warning}
          </section>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-xl font-black text-slate-950">Event table</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {activeMeta.label} · {activeSource.label} · {activeRange ? activeRange.label : "All centuries"} · Page {page}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
                  <Clock3 className="h-4 w-4 text-violet-700" />
                  Lazy source fetch
                </div>

                {activeRange ? (
                  <button
                    type="button"
                    onClick={clearRange}
                    className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:text-rose-600"
                  >
                    <X className="h-4 w-4" />
                    Clear century
                  </button>
                ) : null}

                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 disabled:opacity-40"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Prev
                </button>

                <button
                  type="button"
                  disabled={!hasMore || loading}
                  onClick={() => setPage((prev) => prev + 1)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 disabled:opacity-40"
                >
                  Next
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[720px] overflow-auto">
              <table className="w-full min-w-[760px] table-fixed text-sm">
                <colgroup>
                  <col className="w-[170px]" />
                  <col />
                  <col className="w-[110px]" />
                </colgroup>

                <thead className="sticky top-0 z-10 bg-slate-950 text-white">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide">Timeline</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide">Record</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-12 text-center text-sm font-black text-slate-500">
                        <div className="inline-flex items-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Loading records...
                        </div>
                      </td>
                    </tr>
                  ) : rows.length ? (
                    rows.map((record, index) => (
                      <tr key={`${record.title}-${record.startYear}-${index}`} className="border-t bg-white transition hover:bg-slate-50">
                        <td className="px-4 py-3 align-top">
                          <span className="inline-flex whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">
                            {fmtTimeline(record)}
                          </span>
                        </td>

                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-col gap-1">
                            <div className="text-[14px] font-black leading-5 text-slate-950">
                              {record.title}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-violet-700">
                                {record.type}
                              </span>
                              <span className="text-[11px] font-bold text-slate-400">
                                {record.source.replace("Wikipedia · ", "")}
                              </span>
                            </div>

                            {record.description ? (
                              <p className="line-clamp-2 text-[12px] font-medium leading-5 text-slate-500">
                                {record.description}
                              </p>
                            ) : null}
                          </div>
                        </td>

                        <td className="px-4 py-3 align-top">
                          <button
                            type="button"
                            onClick={() => openDetail(record)}
                            className="inline-flex items-center gap-1 rounded-full bg-slate-950 px-3 py-1.5 text-xs font-black text-white transition hover:bg-slate-800"
                          >
                            Open
                            <ArrowUpRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-4 py-12 text-center text-sm font-semibold text-slate-500">
                        No records returned for this source/search/timeframe.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
              <div className="text-xs font-semibold text-slate-500">
                {rows.length
                  ? `Showing ${fmtNumber(startRow)}–${fmtNumber(endRow)} of ${fmtNumber(total)}`
                  : "No rows to display"}
              </div>

              <div className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700">
                Page {page}
              </div>
            </div>
          </section>

          <FrequencyPanel
            loading={loading}
            buckets={buckets}
            total={buckets.reduce((sum, bucket) => sum + bucket.count, 0)}
            activeRange={activeRange}
            onBucketClick={applyBucket}
            onClearRange={clearRange}
          />
        </section>

        <EventDetailDialog
          qid={detailQid}
          articleUrl={detailArticleUrl}
          fallbackTitle={detailFallbackTitle}
          onClose={() => {
            setDetailQid(null);
            setDetailArticleUrl(null);
            setDetailFallbackTitle(null);
          }}
        />
      </div>
    </main>
  );
}


