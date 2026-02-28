// app/energy/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { Loader2 } from "lucide-react";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

/* =======================
   Types
======================= */

type FmtType = "pct" | "num";

type MetricMeta = {
  key: string;
  label: string;
  unit: string | null;
  fmt: FmtType;
};

type ApiResp = {
  ok: boolean;
  error?: string;

  meta: {
    countries: string[];
    metrics: MetricMeta[];
  };

  country: string;
  metric: string;
  metric_meta: MetricMeta;

  coverage: {
    min_year: number | null;
    max_year: number | null;
    points: number;
  };

  latest: { year: number; value: any } | null;
  series: { year: any; value: any }[];

  rankYear: number;
  top10: Array<{
    rank: number;
    country: string;
    iso_code: string | null;
    year: number;
    value: any;
  }>;
  country_rank: number | null;
  total_countries: number | null;
};

/* =======================
   Helpers (same style as WEO)
======================= */

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  const txt = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(
      `HTTP ${res.status} ${res.statusText}${txt ? ` — ${txt.slice(0, 220)}` : ""}`,
    );
  }
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    throw new Error(
      `Expected JSON but got "${ct || "unknown"}"${txt ? ` — ${txt.slice(0, 220)}` : ""}`,
    );
  }
  return JSON.parse(txt);
}

const toNum = (v: any): number | null => {
  if (v === null || v === undefined) return null;
  // handles "1,234", " 4.3 ", etc.
  const x = Number(String(v).replaceAll(",", "").trim());
  return Number.isFinite(x) ? x : null;
};

function fmtCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const v = n as number;
  if (Math.abs(v) >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(2)}K`;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function fmtVal(
  v: number | null | undefined,
  unit?: string | null,
  fmt?: FmtType,
) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const base =
    fmt === "pct"
      ? (v as number).toLocaleString("en-US", { maximumFractionDigits: 2 })
      : (v as number).toLocaleString("en-US", { maximumFractionDigits: 2 });

  return unit ? `${base} ${unit}` : base;
}

function stableColorFromKey(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 72% 45%)`;
}

function safeText(s: string, max = 60) {
  const t = (s || "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function yPadDomain(values: number[]) {
  if (!values.length) return [0, 1] as [number, number];
  const mn0 = Math.min(...values);
  const mx0 = Math.max(...values);
  if (mn0 === mx0) {
    const pad = mn0 === 0 ? 1 : Math.abs(mn0) * 0.1;
    return [mn0 - pad, mx0 + pad] as [number, number];
  }
  const pad = (mx0 - mn0) * 0.08;
  return [mn0 - pad, mx0 + pad] as [number, number];
}

/* table rows: year, value, delta, deltaPct */
function energyYoYTable(series: { year: number; value: number }[]) {
  const s = (series || [])
    .filter((p) => Number.isFinite(p.year) && Number.isFinite(p.value))
    .sort((a, b) => a.year - b.year);

  return s.map((cur, idx) => {
    const prev = idx > 0 ? s[idx - 1] : null;
    const delta = prev ? cur.value - prev.value : null;
    const deltaPct =
      prev && prev.value !== 0
        ? ((cur.value - prev.value) / Math.abs(prev.value)) * 100
        : null;
    return { year: cur.year, value: cur.value, delta, deltaPct };
  });
}

/* tiny overlay like WEO */
/* ✅ nicer overlay: soft glass fade + floating pill (no big rectangular block) */
function LoadingOverlay({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center">
      {/* subtle fade (keeps layout visible) */}
      <div className="absolute inset-0 rounded-2xl bg-white/35 backdrop-blur-sm" />

      {/* glow behind the pill */}
      <div className="absolute h-28 w-28 rounded-full bg-sky-300/30 blur-2xl" />
      <div className="absolute h-20 w-20 rounded-full bg-emerald-200/30 blur-2xl" />

      {/* floating pill */}
      <div className="relative flex items-center gap-3 rounded-full border border-white/70 bg-white/80 px-4 py-2 shadow-lg">
        {/* custom ring spinner (looks cleaner than a box) */}
        <span className="relative h-5 w-5">
          <span className="absolute inset-0 rounded-full border-2 border-slate-200" />
          <span className="absolute inset-0 rounded-full border-2 border-slate-900 border-t-transparent animate-spin" />
        </span>

        <span className="text-xs font-semibold text-slate-700">{label}</span>

        {/* tiny pulse dot */}
        <span className="ml-1 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
      </div>
    </div>
  );
}

/* =======================
   Page
======================= */

export default function EnergyPage() {
  const [country, setCountry] = useState("World");
  const [metric, setMetric] = useState("renewables_share_energy");
  const [rankYear, setRankYear] = useState<number | null>(null);

  const [resp, setResp] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const debug = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("debug") === "1";
  }, []);

  /* ---------- FETCH ---------- */
  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);

      try {
        const qp = new URLSearchParams();
        qp.set("country", country);
        qp.set("metric", metric);
        if (rankYear != null) qp.set("rankYear", String(rankYear));

        const j = (await fetchJson(`/api/energy?${qp.toString()}`)) as ApiResp;
        if (!alive) return;

        setResp(j);

        if (!j?.ok) setErr(j?.error || "Energy API returned ok=false");

        // adopt server correction (invalid country/metric combos)
        if (j?.ok && j.country && j.country !== country) setCountry(j.country);

        // adopt server default year (only when rankYear not set yet)
        if (rankYear == null && j?.ok && typeof j.rankYear === "number") {
          setRankYear(j.rankYear);
        }

        if (debug) {
          // eslint-disable-next-line no-console
          console.log("[energy] fetched:", {
            country: j.country,
            metric: j.metric,
            points: j.coverage?.points,
            latest: j.latest,
            series0: j.series?.[0],
            seriesN: j.series?.[j.series?.length - 1],
          });
        }
      } catch (e: any) {
        if (!alive) return;
        setResp(null);
        setErr(e?.message || "Failed to load energy data");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, metric, rankYear, debug]);

  const countries = resp?.meta?.countries?.length
    ? resp.meta.countries
    : ["World"];
  const metrics = resp?.meta?.metrics?.length
    ? resp.meta.metrics
    : ([
        {
          key: "renewables_share_energy",
          label: "Renewables share of energy",
          unit: "%",
          fmt: "pct",
        },
      ] as MetricMeta[]);

  const metricMeta =
    resp?.metric_meta ?? metrics.find((m) => m.key === metric) ?? metrics[0];

  /* ---------- NORMALIZE SERIES (this is the “must-have”) ---------- */
  const cleanSeries = useMemo(() => {
    const raw = Array.isArray(resp?.series) ? resp!.series : [];
    const out = raw
      .map((p) => ({ year: Number(p.year), value: toNum(p.value) }))
      .filter((p) => Number.isFinite(p.year) && p.value !== null)
      .map((p) => ({ year: p.year, value: p.value as number }))
      .sort((a, b) => a.year - b.year);

    if (debug) {
      // eslint-disable-next-line no-console
      console.log("[energy] cleanSeries:", {
        rawLen: raw.length,
        cleanLen: out.length,
        first: out[0],
        last: out[out.length - 1],
      });
    }
    return out;
  }, [resp, debug]);

  const table = useMemo(() => energyYoYTable(cleanSeries), [cleanSeries]);

  const lineData = useMemo(() => {
    if (!table.length) return [];
    const take = 40; // energy often has longer series, show more
    return table.slice(Math.max(0, table.length - take));
  }, [table]);

  const latest = useMemo(() => {
    const lv = toNum(resp?.latest?.value);
    const ly = resp?.latest?.year ? Number(resp!.latest!.year) : null;
    if (ly && lv !== null) return { year: ly, value: lv };
    if (!table.length) return null;
    const last = table[table.length - 1];
    return { year: last.year, value: last.value };
  }, [resp, table]);

  const latestDelta = useMemo(() => {
    if (table.length < 2) return null;
    return table[table.length - 1].delta ?? null;
  }, [table]);

  const points = resp?.coverage?.points ?? 0;
  const minYear = resp?.coverage?.min_year ?? null;
  const maxYear = resp?.coverage?.max_year ?? null;

  const yDomain = useMemo(() => {
    const vals = lineData.map((d) => d.value).filter((v) => Number.isFinite(v));
    return yPadDomain(vals);
  }, [lineData]);

  const showOverlay = loading;

  /* ---------- rank years ---------- */
  const rankYearOptions = useMemo(() => {
    if (!minYear || !maxYear) return [];
    const out: number[] = [];
    for (let y = maxYear; y >= minYear; y--) out.push(y);
    return out;
  }, [minYear, maxYear]);

  const top10 = resp?.top10 ?? [];

  /* =======================
     UI
  ======================= */

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* light glass background */}
      <div className="pointer-events-none absolute inset-0 -z-30">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white/90 to-white/80" />
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-sky-300/30 blur-3xl" />
        <div className="absolute top-40 -right-24 h-80 w-80 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-violet-200/30 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-7 space-y-4">
        {/* header + filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs tracking-widest text-slate-500">
              WORLDSTATS360
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              Energy & Power Transition
            </h1>
            <div className="mt-1 text-sm text-slate-700">
              Latest non-null values, complete coverage, and ranking for your
              selection.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className="w-[220px] rounded-xl bg-white/70 backdrop-blur-md border border-white/60 shadow-sm">
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent className="max-h-[360px]">
                {countries.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={metric}
              onValueChange={(v) => {
                setMetric(v);
                setRankYear(null); // let API pick a valid rank year again
              }}
            >
              <SelectTrigger className="w-[320px] rounded-xl bg-white/70 backdrop-blur-md border border-white/60 shadow-sm">
                <SelectValue placeholder="Metric" />
              </SelectTrigger>
              <SelectContent className="max-h-[360px]">
                {metrics.map((m) => (
                  <SelectItem key={m.key} value={m.key}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={String(resp?.rankYear ?? rankYear ?? "")}
              onValueChange={(v) => setRankYear(Number(v))}
            >
              <SelectTrigger className="w-[120px] rounded-xl bg-white/70 backdrop-blur-md border border-white/60 shadow-sm">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent className="max-h-[360px]">
                {rankYearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="secondary"
              className="rounded-xl bg-white/70 backdrop-blur-md border border-white/60 shadow-sm"
              onClick={() => {
                setCountry("World");
                setMetric("renewables_share_energy");
                setRankYear(null);
              }}
            >
              Reset
            </Button>
          </div>
        </div>

        {/* error */}
        {err ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50/90 backdrop-blur p-3 text-sm text-rose-700">
            {err}
          </div>
        ) : null}

        {/* summary cards (like WEO’s top row) */}
        <Card className="shadow-sm bg-white/70 border border-white/60 rounded-2xl">
          <CardHeader className="py-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-sm font-semibold text-slate-800">
                Energy Snapshot
              </CardTitle>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Badge variant="secondary">{country}</Badge>
                <Badge variant="secondary">
                  {safeText(metricMeta.label, 44)}
                </Badge>
                {metricMeta.unit ? (
                  <Badge variant="secondary">{metricMeta.unit}</Badge>
                ) : null}
                <Badge variant="secondary">
                  coverage: {minYear && maxYear ? `${minYear}–${maxYear}` : "—"}
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-xl border bg-white p-3">
                <div className="text-[11px] text-slate-500">Latest</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {latest ? latest.year : "—"}
                </div>
                <div className="mt-1 text-xl font-bold text-slate-900">
                  {latest
                    ? fmtVal(latest.value, metricMeta.unit, metricMeta.fmt)
                    : "—"}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  {metricMeta.unit ?? ""}
                </div>
              </div>

              <div className="rounded-xl border bg-white p-3">
                <div className="text-[11px] text-slate-500">Change (Δ)</div>
                <div className="mt-1 text-xl font-bold text-slate-900">
                  {latestDelta === null
                    ? "—"
                    : fmtVal(latestDelta, metricMeta.unit, metricMeta.fmt)}
                </div>
                <div className="mt-1">
                  {latestDelta === null ? (
                    <Badge variant="secondary">Not enough data</Badge>
                  ) : latestDelta >= 0 ? (
                    <Badge className="bg-emerald-600 text-white">Up</Badge>
                  ) : (
                    <Badge className="bg-rose-600 text-white">Down</Badge>
                  )}
                </div>
              </div>

              <div className="rounded-xl border bg-white p-3">
                <div className="text-[11px] text-slate-500">Rank</div>
                <div className="mt-1 text-xl font-bold text-slate-900">
                  {resp?.country_rank ? `#${resp.country_rank}` : "—"}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  {resp?.total_countries
                    ? `out of ${resp.total_countries}`
                    : "—"}{" "}
                  • {resp?.rankYear ?? "—"}
                </div>
              </div>

              <div className="rounded-xl border bg-white p-3">
                <div className="text-[11px] text-slate-500">Points</div>
                <div className="mt-1 text-xl font-bold text-slate-900">
                  {points}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  {cleanSeries.length
                    ? `clean: ${cleanSeries.length}`
                    : "no data"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* main grid: left trend + table, right top10 */}
        <div className="grid grid-cols-12 gap-4">
          {/* LEFT */}
          <Card className="col-span-12 lg:col-span-8 shadow-sm bg-white/70 border border-white/60 rounded-2xl">
            <CardHeader className="py-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <CardTitle className="text-sm font-semibold text-slate-800">
                    Trend (Line) + Δ%
                  </CardTitle>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {safeText(metricMeta.label, 110)}
                    {metricMeta.unit ? ` • ${metricMeta.unit}` : ""} • {country}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {debug ? (
                    <Badge className="bg-slate-900 text-white">debug=1</Badge>
                  ) : null}
                  {loading ? (
                    <Badge className="bg-slate-900 text-white">Loading…</Badge>
                  ) : null}
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              {err && !table.length && !loading ? (
                <div className="rounded-lg border bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {err}
                </div>
              ) : table.length === 0 && !loading ? (
                <div className="rounded-lg border bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  No series for this selection.
                </div>
              ) : (
                <div className="relative">
                  {showOverlay ? (
                    <LoadingOverlay label="Loading energy data…" />
                  ) : null}

                  <div
                    className={
                      showOverlay
                        ? "pointer-events-none opacity-80 blur-[0.2px]"
                        : ""
                    }
                  >
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                      {/* Chart */}
                      <div className="h-[300px] rounded-lg border bg-white p-2">
                        {/* IMPORTANT: fixed height parent + ResponsiveContainer (same as WEO) */}
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={lineData}
                            margin={{ left: 8, right: 10, top: 10, bottom: 10 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="year" />
                            <YAxis
                              domain={yDomain as any}
                              tickFormatter={(v) => fmtCompact(Number(v))}
                            />
                            <Tooltip
                              labelFormatter={(l) => `Year: ${l}`}
                              formatter={(v: any) =>
                                fmtVal(
                                  typeof v === "number" ? v : toNum(v),
                                  metricMeta.unit,
                                  metricMeta.fmt,
                                )
                              }
                            />
                            <Line
                              type="monotone"
                              dataKey="value"
                              stroke={stableColorFromKey(
                                metricMeta.key || metric,
                              )}
                              strokeWidth={2.5}
                              dot={false}
                              isAnimationActive={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>

                        {debug ? (
                          <div className="mt-2 text-[11px] text-slate-500">
                            raw: {resp?.series?.length ?? 0} • clean:{" "}
                            {cleanSeries.length} • lineData: {lineData.length} •
                            y: {Number(yDomain[0]).toFixed(3)} →{" "}
                            {Number(yDomain[1]).toFixed(3)}
                          </div>
                        ) : null}
                      </div>

                      {/* Table */}
                      <div className="rounded-lg border bg-white">
                        <div className="max-h-[300px] overflow-y-auto overflow-x-hidden">
                          <table className="min-w-full text-xs">
                            <thead className="sticky top-0 bg-slate-50">
                              <tr>
                                <th className="px-3 py-2 text-left font-semibold text-slate-700">
                                  Year
                                </th>
                                <th className="px-3 py-2 text-right font-semibold text-slate-700">
                                  Value
                                </th>
                                <th className="px-3 py-2 text-right font-semibold text-slate-700">
                                  Δ
                                </th>
                                <th className="px-3 py-2 text-right font-semibold text-slate-700">
                                  Δ%
                                </th>
                              </tr>
                            </thead>

                            <tbody>
                              {table
                                .slice()
                                .sort((a, b) => b.year - a.year)
                                .map((r) => (
                                  <tr key={r.year} className="border-t">
                                    <td className="px-3 py-2 text-slate-700">
                                      {r.year}
                                    </td>
                                    <td className="px-3 py-2 text-right font-semibold text-slate-900">
                                      {fmtVal(
                                        r.value,
                                        metricMeta.unit,
                                        metricMeta.fmt,
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-700">
                                      {r.delta === null
                                        ? "—"
                                        : fmtVal(
                                            r.delta,
                                            metricMeta.unit,
                                            metricMeta.fmt,
                                          )}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                      <span
                                        className={[
                                          "inline-flex rounded-full border px-2 py-0.5 font-semibold",
                                          r.deltaPct === null
                                            ? "border-slate-200 text-slate-500"
                                            : r.deltaPct >= 0
                                              ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                                              : "border-rose-200 text-rose-700 bg-rose-50",
                                        ].join(" ")}
                                      >
                                        {r.deltaPct === null
                                          ? "—"
                                          : `${r.deltaPct.toFixed(1)}%`}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="border-t px-3 py-2 text-[11px] text-slate-500">
                          Scroll for more rows
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 text-[11px] text-slate-500">
                      Showing last {Math.min(40, lineData.length)} points •{" "}
                      {country} • {metricMeta.key}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* RIGHT Top10 */}
          <Card className="col-span-12 lg:col-span-4 shadow-sm bg-white/70 border border-white/60 rounded-2xl overflow-hidden">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-semibold text-slate-800">
                Top 10 • {resp?.rankYear ?? "—"}
              </CardTitle>
              <div className="text-[11px] text-slate-500">
                {metricMeta.label}
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              {loading ? (
                <div className="space-y-2 py-2">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-6 rounded bg-slate-200/70 animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                <div className="overflow-auto rounded-xl border border-slate-200/70 max-h-[340px] bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0 z-10">
                      <tr className="text-slate-600">
                        <th className="text-left p-2 w-10">#</th>
                        <th className="text-left p-2">Country</th>
                        <th className="text-right p-2">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {top10.map((r) => {
                        const active = r.country === country;
                        return (
                          <tr
                            key={`${r.rank}-${r.country}`}
                            className={[
                              "border-t cursor-pointer transition",
                              active
                                ? "bg-slate-900/5"
                                : "hover:bg-slate-900/5",
                            ].join(" ")}
                            onClick={() => setCountry(r.country)}
                            title="Click to view this country"
                          >
                            <td className="p-2 text-slate-700">{r.rank}</td>
                            <td className="p-2 text-slate-900 font-medium">
                              {r.country}
                            </td>
                            <td className="p-2 text-right text-slate-800">
                              {fmtVal(
                                toNum(r.value),
                                metricMeta.unit,
                                metricMeta.fmt,
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {!top10.length ? (
                        <tr>
                          <td className="p-3 text-slate-500" colSpan={3}>
                            No ranking data for this year/metric.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              )}

              {debug && !loading ? (
                <div className="mt-2 rounded-lg border bg-white px-3 py-2 text-[11px] text-slate-600">
                  <div className="font-semibold text-slate-900">Debug</div>
                  <div>API ok: {String(resp?.ok)}</div>
                  <div>rankYear: {resp?.rankYear ?? "—"}</div>
                  <div>top10: {top10.length}</div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
