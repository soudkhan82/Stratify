// app/fiscal/_components/FiscalMetricPage.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Download,
  RefreshCw,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type RankRow = {
  country_code: string;
  country_name: string;
  region: string | null;
  year: number;
  value: number;
};

type ApiResp = {
  ok: boolean;
  error?: string;
  meta: {
    slug: string;
    title: string;
    subtitle: string;
    unit: string;
    fmt: "pct" | "num";
  };
  vintage: string;
  rank_year: number;
  ranking: RankRow[];
  series: { year: number; value: number }[];
};

function downloadCsv(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) return;
  const header = Object.keys(rows[0] ?? {});
  const esc = (v: any) => {
    if (v == null) return "";
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = [
    header.join(","),
    ...rows.map((r) => header.map((h) => esc(r[h])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function quantile(sorted: number[], q: number) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] === undefined) return sorted[base];
  return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
}

function fmtValue(v: number, fmt: "pct" | "num") {
  if (!Number.isFinite(v)) return "—";
  if (fmt === "pct") return `${v.toFixed(1)}`;
  const abs = Math.abs(v);
  if (abs >= 1e12) return (v / 1e12).toFixed(2) + "T";
  if (abs >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return (v / 1e3).toFixed(2) + "K";
  return v.toFixed(2);
}

function signPill(v: number) {
  if (!Number.isFinite(v)) return null;
  if (v > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">
        <ArrowUpRight className="h-3.5 w-3.5" />
        Surplus
      </span>
    );
  }
  if (v < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-xs text-rose-700 dark:text-rose-300">
        <ArrowDownRight className="h-3.5 w-3.5" />
        Deficit
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-muted-foreground/30 bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground">
      <Minus className="h-3.5 w-3.5" />
      Balanced
    </span>
  );
}

export default function FiscalMetricPage({
  endpoint,
  title,
  subtitle,
  unit,
  defaultCountry = "PAK",
  defaultTop = 80,
  defaultFrom = 2000,
  defaultTo = 2030,
  defaultYear = "2024",
}: {
  endpoint: string;
  title?: string;
  subtitle?: string;
  unit?: string;
  defaultCountry?: string;
  defaultTop?: number;
  defaultFrom?: number;
  defaultTo?: number;
  defaultYear?: string;
}) {
  const [loadingFull, setLoadingFull] = useState(true);
  const [loadingSeries, setLoadingSeries] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ApiResp | null>(null);

  const [region, setRegion] = useState<string>("ALL");
  const [year, setYear] = useState<string>(defaultYear);
  const [q, setQ] = useState<string>("");
  const [selectedIso3, setSelectedIso3] = useState<string>(defaultCountry);

  const [rankingStable, setRankingStable] = useState<RankRow[]>([]);
  const [rankYearStable, setRankYearStable] = useState<number | null>(null);
  const [vintageStable, setVintageStable] = useState<string | null>(null);
  const [seriesStable, setSeriesStable] = useState<
    { year: number; value: number }[]
  >([]);

  const metaTitle = title ?? data?.meta?.title ?? "Fiscal Metric";
  const metaSubtitle = subtitle ?? data?.meta?.subtitle ?? "";
  const metaUnit = unit ?? data?.meta?.unit ?? "";

  const buildParams = (iso3: string, top: number) => {
    const params = new URLSearchParams();
    if (region !== "ALL") params.set("region", region);
    if (year) params.set("year", year);
    params.set("top", String(top));
    params.set("from", String(defaultFrom));
    params.set("to", String(defaultTo));
    params.set("country", iso3);
    return params.toString();
  };

  const fetchSeriesOnly = async (
    iso3: string,
    existingData?: ApiResp | null,
  ) => {
    setLoadingSeries(true);
    setErr(null);
    try {
      const res = await fetch(`${endpoint}?${buildParams(iso3, 5)}`, {
        cache: "no-store",
      });
      const json: ApiResp = await res.json();
      if (!json.ok) throw new Error(json.error ?? "API error");

      setSelectedIso3(iso3);
      setSeriesStable(json.series ?? []);

      setRankYearStable(
        (existingData ?? data)?.rank_year ?? json.rank_year ?? null,
      );
      setVintageStable((existingData ?? data)?.vintage ?? json.vintage ?? null);

      setData((prev) => prev ?? json);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load series");
    } finally {
      setLoadingSeries(false);
    }
  };

  const fetchFull = async (iso3?: string) => {
    const c = iso3 ?? selectedIso3;
    setLoadingFull(true);
    setErr(null);
    try {
      const res = await fetch(`${endpoint}?${buildParams(c, defaultTop)}`, {
        cache: "no-store",
      });
      const json: ApiResp = await res.json();
      if (!json.ok) throw new Error(json.error ?? "API error");

      setData(json);
      setSelectedIso3(c);

      setRankingStable(json.ranking ?? []);
      setSeriesStable(json.series ?? []);
      setRankYearStable(json.rank_year ?? null);
      setVintageStable(json.vintage ?? null);

      const codes = new Set((json.ranking ?? []).map((r) => r.country_code));
      if (!codes.has(c) && json.ranking?.[0]?.country_code) {
        const fallback = json.ranking[0].country_code;
        setSelectedIso3(fallback);
        await fetchSeriesOnly(fallback, json);
      }
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load");
      setData(null);
      setRankingStable([]);
      setSeriesStable([]);
      setRankYearStable(null);
      setVintageStable(null);
    } finally {
      setLoadingFull(false);
    }
  };

  useEffect(() => {
    fetchFull(defaultCountry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const regions = useMemo(() => {
    const set = new Set<string>();
    rankingStable.forEach((r) => r.region && set.add(r.region));
    return ["ALL", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [rankingStable]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rankingStable;
    return rankingStable.filter(
      (r) =>
        r.country_name.toLowerCase().includes(term) ||
        r.country_code.toLowerCase().includes(term) ||
        (r.region ?? "").toLowerCase().includes(term),
    );
  }, [rankingStable, q]);

  const valuesAsc = useMemo(() => {
    const arr = rankingStable
      .map((r) => Number(r.value))
      .filter((x) => Number.isFinite(x));
    arr.sort((a, b) => a - b);
    return arr;
  }, [rankingStable]);

  const stats = useMemo(() => {
    const n = rankingStable.length;
    const p25 = quantile(valuesAsc, 0.25);
    const med = quantile(valuesAsc, 0.5);
    const p75 = quantile(valuesAsc, 0.75);
    const min = valuesAsc.length ? valuesAsc[0] : null;
    const max = valuesAsc.length ? valuesAsc[valuesAsc.length - 1] : null;
    return { n, p25, med, p75, min, max };
  }, [rankingStable, valuesAsc]);

  const selected = useMemo(() => {
    const idx = rankingStable.findIndex((r) => r.country_code === selectedIso3);
    return idx >= 0
      ? { row: rankingStable[idx], rank: idx + 1, total: rankingStable.length }
      : null;
  }, [rankingStable, selectedIso3]);

  const seriesPoints = useMemo(
    () =>
      (seriesStable ?? []).map((p) => ({ year: p.year, val: Number(p.value) })),
    [seriesStable],
  );

  const fmt = data?.meta?.fmt ?? "pct";

  // ✅ make ~12 rows visible: 12 * 48px + header (~44px) ≈ 620px
  const TABLE_VIEWPORT_PX = 620;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Header */}
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Fiscal Space</div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {metaTitle}
            </h1>
            <div className="mt-1 text-sm text-muted-foreground">
              {metaSubtitle} • Vintage:{" "}
              <span className="text-foreground">{vintageStable ?? "—"}</span> •
              Year:{" "}
              <span className="text-foreground">{rankYearStable ?? "—"}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => fetchFull()}
              disabled={loadingFull}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${loadingFull ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const rows = filtered.map((r, i) => ({
                  rank: i + 1,
                  year: r.year,
                  iso3: r.country_code,
                  country: r.country_name,
                  region: r.region ?? "",
                  value: r.value,
                }));
                downloadCsv(
                  `fiscal_${data?.meta?.slug ?? "metric"}_${rankYearStable ?? "latest"}.csv`,
                  rows,
                );
              }}
              disabled={!filtered.length}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {err && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
            <div className="font-medium">API Error</div>
            <div className="text-muted-foreground">{err}</div>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs text-muted-foreground">
                Countries
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-semibold leading-none">
                {stats.n || "—"}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                Ranking list size
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs text-muted-foreground">
                Median
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-semibold leading-none">
                {stats.med == null ? "—" : fmtValue(stats.med, fmt)}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {metaUnit}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs text-muted-foreground">
                P75
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-semibold leading-none">
                {stats.p75 == null ? "—" : fmtValue(stats.p75, fmt)}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {metaUnit}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs text-muted-foreground">
                Max
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-semibold leading-none">
                {stats.max == null ? "—" : fmtValue(stats.max, fmt)}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {metaUnit}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Controls + Table + Trend */}
        <div className="mt-3 grid gap-3 lg:grid-cols-12">
          {/* Table */}
          <Card className="lg:col-span-7">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ranking</CardTitle>

              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search country / ISO3 / region"
                  />
                </div>

                <Select value={region} onValueChange={(v) => setRegion(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Region" />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex gap-2">
                  <Input
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="Year (blank = latest)"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fetchFull()}
                    disabled={loadingFull}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {/* ✅ ENERGY STANDARD TABLE TEMPLATE */}
              <div className="rounded-lg border bg-white">
                <div
                  className="max-h-[620px] overflow-y-auto overflow-x-hidden"
                  style={{ maxHeight: TABLE_VIEWPORT_PX }}
                >
                  <table className="min-w-full text-sm">
                    {/* ✅ Sticky header like Energy */}
                    <thead className="sticky top-0 z-10 bg-slate-900">
                      <tr className="text-white">
                        <th className="px-3 py-2 w-[60px] text-left font-semibold">
                          #
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          Country
                        </th>
                        <th className="px-3 py-2 w-[160px] text-right font-semibold">
                          Value
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {loadingFull && (
                        <tr className="border-t">
                          <td className="px-3 py-10 text-slate-500" colSpan={3}>
                            Loading…
                          </td>
                        </tr>
                      )}

                      {!loadingFull && filtered.length === 0 && (
                        <tr className="border-t">
                          <td className="px-3 py-10 text-slate-500" colSpan={3}>
                            No results.
                          </td>
                        </tr>
                      )}

                      {!loadingFull &&
                        filtered.map((r, i) => {
                          const active = r.country_code === selectedIso3;

                          return (
                            <tr
                              key={`${r.country_code}-${r.year}`}
                              onClick={() => {
                                if (r.country_code === selectedIso3) return;
                                setSelectedIso3(r.country_code);
                                fetchSeriesOnly(r.country_code);
                              }}
                              className={[
                                "border-b transition-colors",
                                "hover:bg-muted/50",
                                active ? "bg-muted/60" : "",
                              ].join(" ")}
                              style={{ cursor: "pointer" }} // ✅ GUARANTEES pointer for the row
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  if (r.country_code === selectedIso3) return;
                                  setSelectedIso3(r.country_code);
                                  fetchSeriesOnly(r.country_code);
                                }
                              }}
                              title="Click to update trend (table will not refresh)"
                            >
                              <td className="px-3 py-2 text-muted-foreground cursor-pointer">
                                {i + 1}
                              </td>

                              <td className="px-3 py-2 cursor-pointer">
                                <div className="font-medium">
                                  {r.country_name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {r.country_code} • {r.region ?? "—"}
                                </div>
                              </td>

                              <td className="px-3 py-2 font-medium cursor-pointer">
                                {fmtValue(Number(r.value), fmt)} {metaUnit}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                {/* Footer hint like Energy */}
                <div className="border-t px-3 py-2 text-[11px] text-slate-500">
                  Scroll for more rows
                </div>
              </div>

              {selected && (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <div>
                    Selected:{" "}
                    <span className="text-foreground font-medium">
                      {selected.row.country_name}
                    </span>{" "}
                    ({selected.row.country_code}) • Rank #{selected.rank}/
                    {selected.total}
                  </div>
                  <div className="flex items-center gap-2">
                    {signPill(Number(selected.row.value))}
                    <span className="text-foreground font-medium">
                      {fmtValue(Number(selected.row.value), fmt)} {metaUnit}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Trend */}
          <Card className="lg:col-span-5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Trend • {selectedIso3}
              </CardTitle>
              <div className="text-xs text-muted-foreground">
                {defaultFrom}–{defaultTo} • {metaUnit}
              </div>
            </CardHeader>

            <CardContent>
              <div className="h-[340px] rounded-lg border relative">
                {loadingSeries && (
                  <div className="absolute inset-0 grid place-items-center bg-background/60">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Loading trend…
                    </div>
                  </div>
                )}

                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={seriesPoints}
                    margin={{ top: 14, right: 14, left: 0, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                    <XAxis dataKey="year" />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="val"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-2 text-xs text-muted-foreground">
                Click a country row — only the trend updates (table stays
                stable).
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 text-xs text-muted-foreground">
          API: <span className="font-mono">{endpoint}</span> • Series:{" "}
          <span className="text-foreground">{seriesPoints.length}</span> • Rows:{" "}
          <span className="text-foreground">{rankingStable.length}</span>
        </div>
      </div>
    </div>
  );
}
