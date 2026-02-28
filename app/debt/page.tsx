"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Download, RefreshCw, Search, ArrowUp } from "lucide-react";

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

/* ───────────────────────── Types ───────────────────────── */
type RiskBand = "Low" | "Moderate" | "High" | "Extreme";

type RankRow = {
  country_code: string;
  country_name: string;
  region: string | null;
  year: number;
  debt_gross_pct_gdp: number;
  risk_band: RiskBand;
  risk_score: number;
};

type SeriesResp = {
  ok: boolean;
  vintage: string;
  rank_year: number | null;
  series: {
    min_year: number;
    max_year: number;
    country: {
      country_code: string;
      country_name: string;
      region: string | null;
    } | null;
    points: { year: number; value: number }[];
  };
  error?: string;
};

type RankingResp = {
  ok: boolean;
  vintage: string;
  rank_year: number | null;
  totals: { countries: number };
  ranking: RankRow[];
  error?: string;
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

function pct(n: number, d: number) {
  if (!d) return "0%";
  return `${Math.round((n / d) * 100)}%`;
}

function quantile(sorted: number[], q: number) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] === undefined) return sorted[base];
  return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
}

function bandColor(b: RiskBand) {
  switch (b) {
    case "Low":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
    case "Moderate":
      return "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30";
    case "High":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30";
    case "Extreme":
      return "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30";
  }
}

export default function DebtPage() {
  // ✅ Separate loading flags
  const [loadingRanking, setLoadingRanking] = useState(true);
  const [loadingSeries, setLoadingSeries] = useState(false);

  const [err, setErr] = useState<string | null>(null);

  // ✅ Separate state for ranking vs series
  const [rankingData, setRankingData] = useState<RankingResp | null>(null);
  const [seriesData, setSeriesData] = useState<SeriesResp | null>(null);

  const [region, setRegion] = useState<string>("ALL");
  const [rankYear, setRankYear] = useState<string>(""); // input box
  const [q, setQ] = useState<string>("");

  const [selectedIso3, setSelectedIso3] = useState<string | null>(null);

  // Prevent race conditions in rapid clicks
  const seriesReqId = useRef(0);

  const buildCommonParams = () => {
    const params = new URLSearchParams();
    if (region !== "ALL") params.set("region", region);
    if (rankYear) params.set("year", rankYear);
    return params;
  };

  // ✅ Fetch ranking ONLY
  const fetchRanking = async () => {
    setLoadingRanking(true);
    setErr(null);

    try {
      const params = buildCommonParams();

      // If your backend supports mode:
      params.set("mode", "ranking");

      const res = await fetch(`/api/debt?${params.toString()}`, {
        cache: "no-store",
      });

      const json = (await res.json()) as any;

      // If backend doesn't support mode=ranking, it will still return ok + ranking + series.
      if (!json.ok) throw new Error(json.error ?? "API error");

      const rankResp: RankingResp = {
        ok: json.ok,
        vintage: json.vintage,
        rank_year: json.rank_year ?? null,
        totals: json.totals ?? { countries: json.ranking?.length ?? 0 },
        ranking: json.ranking ?? [],
      };

      setRankingData(rankResp);

      // Default selection once (or keep current if still present)
      const firstIso3 = rankResp.ranking?.[0]?.country_code ?? null;

      setSelectedIso3((prev) => {
        if (prev && rankResp.ranking.some((r) => r.country_code === prev))
          return prev;
        return prev ?? firstIso3;
      });

      // Ensure we have a chart on first load
      const isoToLoad =
        selectedIso3 &&
        rankResp.ranking.some((r) => r.country_code === selectedIso3)
          ? selectedIso3
          : firstIso3;

      if (isoToLoad) {
        // Fetch series, but DOES NOT reload ranking/table UI
        await fetchSeries(isoToLoad);
      } else {
        setSeriesData(null);
      }
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load");
      setRankingData(null);
      setSeriesData(null);
    } finally {
      setLoadingRanking(false);
    }
  };

  // ✅ Fetch series ONLY (triggered by row click)
  const fetchSeries = async (iso3: string) => {
    const req = ++seriesReqId.current;
    setLoadingSeries(true);
    setErr(null);

    try {
      const params = buildCommonParams();
      params.set("iso3", iso3);

      // If your backend supports mode:
      params.set("mode", "series");

      const res = await fetch(`/api/debt?${params.toString()}`, {
        cache: "no-store",
      });

      const json = (await res.json()) as any;
      if (!json.ok) throw new Error(json.error ?? "API error");

      // Ignore outdated responses
      if (req !== seriesReqId.current) return;

      const sResp: SeriesResp = {
        ok: json.ok,
        vintage: json.vintage,
        rank_year: json.rank_year ?? null,
        series: json.series,
      };

      setSeriesData(sResp);
    } catch (e: any) {
      if (req !== seriesReqId.current) return;
      setErr(e?.message ?? "Failed to load series");
      setSeriesData(null);
    } finally {
      if (req === seriesReqId.current) setLoadingSeries(false);
    }
  };

  // Initial load (ranking + default series)
  useEffect(() => {
    fetchRanking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ranking = rankingData?.ranking ?? [];

  const regions = useMemo(() => {
    const set = new Set<string>();
    ranking.forEach((r) => r.region && set.add(r.region));
    return ["ALL", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [ranking]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return ranking;
    return ranking.filter(
      (r) =>
        r.country_name.toLowerCase().includes(term) ||
        r.country_code.toLowerCase().includes(term) ||
        (r.region ?? "").toLowerCase().includes(term),
    );
  }, [ranking, q]);

  const valuesSortedAsc = useMemo(() => {
    const arr = ranking
      .map((r) => Number(r.debt_gross_pct_gdp))
      .filter((x) => Number.isFinite(x));
    arr.sort((a, b) => a - b);
    return arr;
  }, [ranking]);

  const stats = useMemo(() => {
    const n = ranking.length;
    const med = quantile(valuesSortedAsc, 0.5);
    const p75 = quantile(valuesSortedAsc, 0.75);
    const p25 = quantile(valuesSortedAsc, 0.25);
    const max = valuesSortedAsc.length
      ? valuesSortedAsc[valuesSortedAsc.length - 1]
      : null;

    const bandCounts = ranking.reduce(
      (acc, r) => {
        acc[r.risk_band] = (acc[r.risk_band] ?? 0) + 1;
        return acc;
      },
      {} as Record<RiskBand, number>,
    );

    const highExtreme = (bandCounts.High ?? 0) + (bandCounts.Extreme ?? 0);

    return { n, med, p75, p25, max, bandCounts, highExtreme };
  }, [ranking, valuesSortedAsc]);

  const selected = useMemo(() => {
    if (!selectedIso3) return null;
    const idx = ranking.findIndex((r) => r.country_code === selectedIso3);
    if (idx === -1) return null;
    return { row: ranking[idx], rank: idx + 1, total: ranking.length };
  }, [ranking, selectedIso3]);

  const seriesPoints = useMemo(() => {
    return (seriesData?.series?.points ?? []).map((p) => ({
      year: p.year,
      debt: Number(p.value),
    }));
  }, [seriesData]);

  const headerVintage = rankingData?.vintage ?? seriesData?.vintage ?? "—";
  const headerYear = rankingData?.rank_year ?? seriesData?.rank_year ?? "—";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Header */}
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs text-muted-foreground">
              WorldStats360 • Stratify
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Debt Sustainability
            </h1>
            <div className="mt-1 text-sm text-muted-foreground">
              Metric:{" "}
              <span className="text-foreground">
                Gross Debt % of GDP (GGXWDG_NGDP)
              </span>{" "}
              • Vintage:{" "}
              <span className="text-foreground">{headerVintage}</span> • Ranking
              Year: <span className="text-foreground">{headerYear}</span>
            </div>
          </div>

          <div className="flex gap-2">
            {/* Refresh ranking + (default) series */}
            <Button
              variant="outline"
              onClick={fetchRanking}
              disabled={loadingRanking}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${loadingRanking ? "animate-spin" : ""}`}
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
                  debt_gross_pct_gdp: r.debt_gross_pct_gdp,
                  risk_band: r.risk_band,
                  risk_score: r.risk_score,
                }));
                downloadCsv(`debt_ranking_${headerYear}.csv`, rows);
              }}
              disabled={!filtered.length}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Error */}
        {err && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
            <div className="font-medium">API Error</div>
            <div className="text-muted-foreground">{err}</div>
          </div>
        )}

        {/* Summary cards (your compact grid is already good) */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Countries in ranking
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-3xl font-semibold">
                {loadingRanking ? "—" : stats.n || "—"}
              </div>
              <div className="text-xs text-muted-foreground">
                Top list size = {Math.min(50, stats.n) || 0} by default
              </div>
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Global median debt
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-3xl font-semibold">
                {stats.med == null ? "—" : stats.med.toFixed(1) + "%"}
              </div>
              <div className="text-xs text-muted-foreground">
                P25 {stats.p25 == null ? "—" : stats.p25.toFixed(1) + "%"} • P75{" "}
                {stats.p75 == null ? "—" : stats.p75.toFixed(1) + "%"}
              </div>
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                High + Extreme
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-3xl font-semibold">
                {stats.highExtreme || 0}
              </div>
              <div className="text-xs text-muted-foreground">
                Share of ranking: {pct(stats.highExtreme || 0, stats.n || 0)}
              </div>
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Maximum debt
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-3xl font-semibold">
                {stats.max == null ? "—" : stats.max.toFixed(1) + "%"}
              </div>
              <div className="text-xs text-muted-foreground">
                Outliers exist; scoring caps above 120%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters + Ranking + Trend */}
        <div className="mt-3 grid gap-3 lg:grid-cols-12">
          {/* Ranking */}
          <Card className="lg:col-span-7">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Debt ranking table</CardTitle>

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
                    value={rankYear}
                    onChange={(e) => setRankYear(e.target.value)}
                    placeholder="Year (blank = latest)"
                  />
                  {/* ✅ Apply now ONLY refetches ranking (and then loads series for selected/default) */}
                  <Button
                    variant="outline"
                    onClick={fetchRanking}
                    disabled={loadingRanking}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <div
                  className="relative overflow-y-auto overflow-x-auto"
                  style={{ maxHeight: "calc(12 * 44px + 41px)" }}
                >
                  <table className="w-full text-sm border-separate border-spacing-0">
                    <thead>
                      <tr className="text-left">
                        <th className="sticky top-0 z-20 px-3 py-2 bg-slate-900 text-white border-b border-slate-700">
                          Rank
                        </th>
                        <th className="sticky top-0 z-20 px-3 py-2 bg-slate-900 text-white border-b border-slate-700">
                          Country
                        </th>
                        <th className="sticky top-0 z-20 px-3 py-2 bg-slate-900 text-white border-b border-slate-700">
                          Debt %
                        </th>
                        <th className="sticky top-0 z-20 px-3 py-2 bg-slate-900 text-white border-b border-slate-700">
                          Band
                        </th>
                        <th className="sticky top-0 z-20 px-3 py-2 bg-slate-900 text-white border-b border-slate-700">
                          Score
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingRanking && (
                        <tr>
                          <td
                            className="px-3 py-10 text-muted-foreground"
                            colSpan={5}
                          >
                            Loading ranking…
                          </td>
                        </tr>
                      )}

                      {!loadingRanking && filtered.length === 0 && (
                        <tr>
                          <td
                            className="px-3 py-10 text-muted-foreground"
                            colSpan={5}
                          >
                            No results.
                          </td>
                        </tr>
                      )}

                      {!loadingRanking &&
                        filtered.map((r, i) => {
                          const active = r.country_code === selectedIso3;

                          return (
                            <tr
                              key={`${r.country_code}-${r.year}`}
                              onClick={() => {
                                if (r.country_code === selectedIso3) return;
                                setSelectedIso3(r.country_code);
                                fetchSeries(r.country_code);
                              }}
                              className={[
                                "border-b transition-colors",
                                "hover:bg-muted/50",
                                active ? "bg-muted/60" : "",
                              ].join(" ")}
                              style={{ cursor: "pointer" }} // ✅ guarantees pointer on table rows
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setSelectedIso3(r.country_code);
                                  fetchSeries(r.country_code);
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
                                {r.debt_gross_pct_gdp.toFixed(1)}%
                              </td>

                              <td className="px-3 py-2 cursor-pointer">
                                <span
                                  className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${bandColor(
                                    r.risk_band,
                                  )}`}
                                >
                                  {r.risk_band}
                                </span>
                              </td>

                              <td className="px-3 py-2 cursor-pointer">
                                {r.risk_score.toFixed(1)}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-2 text-xs text-muted-foreground">
                Interpretation: Rank 1 has the highest Debt/GDP in the selected
                year.
              </div>
            </CardContent>
          </Card>

          {/* Trend */}
          <Card className="lg:col-span-5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Trend •{" "}
                {seriesData?.series?.country?.country_name ??
                  selectedIso3 ??
                  "—"}
              </CardTitle>
              <div className="text-xs text-muted-foreground">
                Gross Debt % GDP • {seriesData?.series?.min_year ?? 1980}–
                {seriesData?.series?.max_year ?? 2030}
              </div>
            </CardHeader>

            <CardContent>
              <div className="h-[340px] rounded-lg border relative">
                {/* ✅ Only chart shows loading overlay */}
                {loadingSeries && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm z-10">
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
                      dataKey="debt"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-2 text-xs text-muted-foreground">
                Tip: click a country row to update only the trend chart.
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Keep your other sections below if you want (breakdown/snapshot) */}
        <div className="mt-6 text-xs text-muted-foreground">
          Bands: Low &lt; 35 • Moderate 35–70 • High 70–120 • Extreme &gt; 120
          (Debt/GDP). Scoring caps above 120%.
        </div>
      </div>
    </div>
  );
}
