"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Bolt,
  Factory,
  Flame,
  Gauge,
  Globe2,
  Leaf,
  RefreshCw,
  Zap,
} from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type FmtType = "pct" | "num";

type MetricMeta = {
  key: string;
  label: string;
  unit: string | null;
  fmt: FmtType;
};

type LiveMetric = MetricMeta & {
  year: number | null;
  value: unknown;
};

type ApiResp = {
  ok: boolean;
  error?: string;
  meta: { countries: string[]; metrics: MetricMeta[] };
  country: string;
  metric: string;
  metric_meta: MetricMeta;
  coverage: { min_year: number | null; max_year: number | null; points: number };
  latest: { year: number; value: unknown } | null;
  series: Array<{ year: unknown; value: unknown }>;
  rankYear: number;
  top10: Array<{
    rank: number;
    country: string;
    iso_code: string | null;
    year: number;
    value: unknown;
  }>;
  country_rank: number | null;
  total_countries: number | null;
  live_pack: LiveMetric[];
};

type HistoryRow = {
  year: number;
  value: number;
  delta: number | null;
  deltaPct: number | null;
};

const MIX_COLORS = ["#f97316", "#22c55e", "#8b5cf6"];

async function fetchJson(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  const text = await response.text().catch(() => "");

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${response.statusText}${text ? ` â€” ${text.slice(0, 220)}` : ""}`,
    );
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      `Expected JSON but received "${contentType || "unknown"}"${text ? ` â€” ${text.slice(0, 220)}` : ""}`,
    );
  }

  return JSON.parse(text);
}

function toNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(String(value).replaceAll(",", "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function fmtCompact(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "â€”";
  const absolute = Math.abs(value);
  if (absolute >= 1e12) return `${(value / 1e12).toFixed(digits)}T`;
  if (absolute >= 1e9) return `${(value / 1e9).toFixed(digits)}B`;
  if (absolute >= 1e6) return `${(value / 1e6).toFixed(digits)}M`;
  if (absolute >= 1e3) return `${(value / 1e3).toFixed(digits)}K`;
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function fmtValue(value: number | null | undefined, unit?: string | null, fmt?: FmtType) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "â€”";
  const formatted = value.toLocaleString("en-US", {
    maximumFractionDigits: fmt === "pct" ? 2 : 2,
  });
  return unit ? `${formatted} ${unit}` : formatted;
}

function paddedDomain(values: number[]): [number, number] {
  if (!values.length) return [0, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    const padding = min === 0 ? 1 : Math.abs(min) * 0.1;
    return [min - padding, max + padding];
  }
  const padding = (max - min) * 0.08;
  return [min - padding, max + padding];
}

function buildHistory(series: Array<{ year: number; value: number }>): HistoryRow[] {
  const sorted = [...series].sort((a, b) => a.year - b.year);
  return sorted.map((current, index) => {
    const previous = index > 0 ? sorted[index - 1] : null;
    const delta = previous ? current.value - previous.value : null;
    const deltaPct =
      previous && previous.value !== 0
        ? ((current.value - previous.value) / Math.abs(previous.value)) * 100
        : null;
    return { year: current.year, value: current.value, delta, deltaPct };
  });
}

function secondsInCurrentYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 1);
  const end = new Date(date.getFullYear() + 1, 0, 1);
  return Math.max(1, (end.getTime() - start.getTime()) / 1000);
}

function secondsSinceLocalMidnight(date: Date) {
  const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.max(0, (date.getTime() - midnight.getTime()) / 1000);
}

function annualTwhToTodayGwh(annualTwh: number | null, now: Date): number | null {
  if (annualTwh === null || !Number.isFinite(annualTwh)) return null;
  return annualTwh * 1000 * (secondsSinceLocalMidnight(now) / secondsInCurrentYear(now));
}

function useLiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 250);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function LiveCounterCard({
  title,
  value,
  unit,
  icon,
  description,
  accentClass,
}: {
  title: string;
  value: number | null;
  unit: string;
  icon: React.ReactNode;
  description: string;
  accentClass: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accentClass}`} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</div>
          <div className="mt-2 tabular-nums text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            {value === null
              ? "â€”"
              : value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </div>
          <div className="mt-0.5 text-xs font-semibold text-slate-600">{unit}</div>
        </div>
        <div className="rounded-xl bg-slate-950 p-2.5 text-white shadow-sm">{icon}</div>
      </div>
      <div className="mt-3 border-t border-slate-100 pt-2 text-[11px] leading-5 text-slate-500">
        {description}
      </div>
    </div>
  );
}

function MetricStat({
  label,
  value,
  unit,
  year,
}: {
  label: string;
  value: number | null;
  unit: string;
  year: number | null;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-bold text-slate-950">
        {value === null ? "â€”" : fmtValue(value, unit)}
      </div>
      <div className="mt-0.5 text-[10px] text-slate-400">
        Latest annual value{year ? ` â€¢ ${year}` : ""}
      </div>
    </div>
  );
}

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="rounded-3xl border border-slate-200 bg-white px-10 py-8 text-center shadow-xl">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-violet-600" />
        <h2 className="text-lg font-semibold text-slate-900">Loading World Energy Live</h2>
        <p className="mt-1 text-sm text-slate-500">Preparing annual data and live estimates</p>
      </div>
    </div>
  );
}

export default function EnergyPage() {
  const [country, setCountry] = useState("World");
  const [metric, setMetric] = useState("primary_energy_consumption");
  const [rankYear, setRankYear] = useState<number | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [response, setResponse] = useState<ApiResp | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = useLiveClock();

  useEffect(() => {
    let active = true;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ country, metric });
        if (rankYear !== null) params.set("rankYear", String(rankYear));

        const data = (await fetchJson(`/api/energy?${params.toString()}`)) as ApiResp;
        if (!active) return;

        setResponse(data);
        if (!data.ok) {
          setError(data.error || "Energy API returned ok=false");
          return;
        }
        if (data.country && data.country !== country) setCountry(data.country);
        if (rankYear === null && Number.isFinite(data.rankYear)) setRankYear(data.rankYear);
      } catch (caught: any) {
        if (!active) return;
        setError(caught?.message || "Failed to load energy data");
      } finally {
        if (active) {
          setLoading(false);
          setInitialLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [country, metric, rankYear, refreshToken]);

  const countries = response?.meta?.countries?.length ? response.meta.countries : ["World"];
  const metrics = response?.meta?.metrics?.length
    ? response.meta.metrics
    : [{ key: "primary_energy_consumption", label: "Primary energy consumption", unit: "TWh", fmt: "num" as const }];
  const metricMeta = response?.metric_meta ?? metrics.find((item) => item.key === metric) ?? metrics[0];

  const cleanSeries = useMemo(() => {
    const raw = Array.isArray(response?.series) ? response.series : [];
    return raw
      .map((point) => ({ year: Number(point.year), value: toNum(point.value) }))
      .filter(
        (point): point is { year: number; value: number } =>
          Number.isFinite(point.year) && point.value !== null,
      )
      .sort((a, b) => a.year - b.year);
  }, [response]);

  const history = useMemo(() => buildHistory(cleanSeries), [cleanSeries]);
  const lineData = useMemo(() => history.slice(Math.max(0, history.length - 45)), [history]);
  const yDomain = useMemo(() => paddedDomain(lineData.map((point) => point.value)), [lineData]);

  const liveByKey = useMemo(() => {
    const map = new Map<string, LiveMetric>();
    for (const item of response?.live_pack ?? []) map.set(item.key, item);
    return map;
  }, [response]);

  const liveValue = (key: string) => toNum(liveByKey.get(key)?.value);
  const liveYear = (key: string) => liveByKey.get(key)?.year ?? null;

  const annualConsumption = liveValue("primary_energy_consumption");
  const fossilShare = liveValue("fossil_share_energy");
  const renewableShare = liveValue("renewables_share_energy");
  const lowCarbonShare = liveValue("low_carbon_share_energy");
  const annualGeneration = liveValue("electricity_generation");
  const annualDemand = liveValue("electricity_demand");

  const energyToday = annualTwhToTodayGwh(annualConsumption, now);
  const generationToday = annualTwhToTodayGwh(annualGeneration, now);
  const demandToday = annualTwhToTodayGwh(annualDemand, now);
  const fossilToday = energyToday !== null && fossilShare !== null ? energyToday * (fossilShare / 100) : null;
  const renewableToday = energyToday !== null && renewableShare !== null ? energyToday * (renewableShare / 100) : null;
  const lowCarbonToday = energyToday !== null && lowCarbonShare !== null ? energyToday * (lowCarbonShare / 100) : null;

  const otherLowCarbonShare =
    lowCarbonShare !== null && renewableShare !== null
      ? Math.max(0, lowCarbonShare - renewableShare)
      : fossilShare !== null && renewableShare !== null
        ? Math.max(0, 100 - fossilShare - renewableShare)
        : null;

  const mixData = useMemo(
    () =>
      [
        { name: "Fossil fuels", value: fossilShare },
        { name: "Renewables", value: renewableShare },
        { name: "Other low-carbon", value: otherLowCarbonShare },
      ].filter(
        (item): item is { name: string; value: number } =>
          item.value !== null && Number.isFinite(item.value) && item.value > 0,
      ),
    [fossilShare, renewableShare, otherLowCarbonShare],
  );

  const rankYearOptions = useMemo(() => {
    const min = response?.coverage?.min_year;
    const max = response?.coverage?.max_year;
    if (!min || !max) return [];
    const years: number[] = [];
    for (let year = max; year >= min; year--) years.push(year);
    return years;
  }, [response]);

  const latest = useMemo(() => {
    const apiValue = toNum(response?.latest?.value);
    const apiYear = response?.latest?.year ? Number(response.latest.year) : null;
    if (apiYear && apiValue !== null) return { year: apiYear, value: apiValue };
    return cleanSeries.length ? cleanSeries[cleanSeries.length - 1] : null;
  }, [response, cleanSeries]);

  const top10 = response?.top10 ?? [];
  const isRefreshing = loading && !initialLoading;

  if (initialLoading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.11),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.10),_transparent_30%),linear-gradient(to_bottom,_#f8fafc,_#eef2ff)]">
      <main className="mx-auto max-w-[1500px] space-y-4 px-4 py-6 lg:px-6">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-indigo-950 to-violet-950 px-5 py-6 !text-white shadow-2xl lg:px-7">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-20 -top-24 h-72 w-72 rounded-full bg-violet-600/30 blur-3xl" />
            <div className="absolute -right-16 top-0 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl" />
            <div className="absolute bottom-0 left-1/2 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-violet-400 to-transparent" />
          </div>

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] !text-violet-200">
                <Activity className="h-4 w-4" />
                Stratify Energy Intelligence
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight !text-white drop-shadow-sm sm:text-4xl lg:text-5xl">World Energy Live</h1>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 !text-slate-200 sm:text-base">
                Running estimates for energy consumed, generated and demanded todayâ€”supported by Stratify&apos;s latest annual energy data.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge className="bg-violet-500 text-white hover:bg-violet-500">Estimated live counters</Badge>
                <Badge className="bg-white/10 text-white hover:bg-white/10">Resets at local midnight</Badge>
                <Badge className="bg-white/10 text-white hover:bg-white/10">Scope: {country}</Badge>
              </div>
            </div>

            <div className="grid w-full gap-2 sm:grid-cols-2 xl:w-auto xl:grid-cols-[220px_310px_120px_auto]">
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger className="border-white/25 bg-white/10 !text-white shadow-none [&>span]:!text-white hover:bg-white/15">
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent className="max-h-[360px]">
                  {countries.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={metric}
                onValueChange={(value) => {
                  setMetric(value);
                  setRankYear(null);
                }}
              >
                <SelectTrigger className="border-white/25 bg-white/10 !text-white shadow-none [&>span]:!text-white hover:bg-white/15">
                  <SelectValue placeholder="Historical metric" />
                </SelectTrigger>
                <SelectContent className="max-h-[360px]">
                  {metrics.map((item) => (
                    <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={rankYear === null ? undefined : String(rankYear)}
                onValueChange={(value) => setRankYear(Number(value))}
                disabled={!rankYearOptions.length}
              >
                <SelectTrigger className="border-white/25 bg-white/10 !text-white shadow-none [&>span]:!text-white hover:bg-white/15">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent className="max-h-[360px]">
                  {rankYearOptions.map((year) => (
                    <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                onClick={() => setRefreshToken((value) => value + 1)}
                disabled={loading}
                className="gap-2 bg-violet-600 text-white hover:bg-violet-500"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <LiveCounterCard
            title="Energy consumed today"
            value={energyToday}
            unit="GWh since midnight"
            icon={<Gauge className="h-5 w-5" />}
            description={`Estimated from ${liveYear("primary_energy_consumption") ?? "the latest"} primary-energy consumption.`}
            accentClass="from-violet-600 to-indigo-500"
          />
          <LiveCounterCard
            title="Fossil-fuel energy today"
            value={fossilToday}
            unit="GWh since midnight"
            icon={<Flame className="h-5 w-5" />}
            description={`Applies the latest fossil share${fossilShare !== null ? ` (${fossilShare.toFixed(1)}%)` : ""} to today's energy estimate.`}
            accentClass="from-orange-500 to-rose-500"
          />
          <LiveCounterCard
            title="Renewable energy today"
            value={renewableToday}
            unit="GWh since midnight"
            icon={<Leaf className="h-5 w-5" />}
            description={`Applies the latest renewable share${renewableShare !== null ? ` (${renewableShare.toFixed(1)}%)` : ""} to today's energy estimate.`}
            accentClass="from-emerald-500 to-green-400"
          />
          <LiveCounterCard
            title="Low-carbon energy today"
            value={lowCarbonToday}
            unit="GWh since midnight"
            icon={<Globe2 className="h-5 w-5" />}
            description={`Includes the latest available low-carbon share${lowCarbonShare !== null ? ` (${lowCarbonShare.toFixed(1)}%)` : ""}.`}
            accentClass="from-sky-500 to-cyan-400"
          />
          <LiveCounterCard
            title="Electricity generated today"
            value={generationToday}
            unit="GWh since midnight"
            icon={<Zap className="h-5 w-5" />}
            description={`Estimated from ${liveYear("electricity_generation") ?? "the latest"} annual electricity generation.`}
            accentClass="from-amber-400 to-orange-500"
          />
          <LiveCounterCard
            title="Electricity demand today"
            value={demandToday}
            unit="GWh since midnight"
            icon={<Bolt className="h-5 w-5" />}
            description={`Estimated from ${liveYear("electricity_demand") ?? "the latest"} annual electricity demand.`}
            accentClass="from-fuchsia-500 to-violet-600"
          />
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricStat label="Annual primary-energy consumption" value={annualConsumption} unit="TWh" year={liveYear("primary_energy_consumption")} />
          <MetricStat label="Annual electricity generation" value={annualGeneration} unit="TWh" year={liveYear("electricity_generation")} />
          <MetricStat label="Annual electricity demand" value={annualDemand} unit="TWh" year={liveYear("electricity_demand")} />
          <MetricStat label="Selected metric" value={latest?.value ?? null} unit={metricMeta.unit ?? ""} year={latest?.year ?? null} />
        </section>

        <section className="grid grid-cols-12 gap-4">
          <Card className="col-span-12 overflow-hidden rounded-2xl border-slate-200 bg-white/90 shadow-sm xl:col-span-8">
            <CardHeader className="border-b border-slate-100 pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="h-5 w-5 text-violet-600" />
                    Historical energy trend
                  </CardTitle>
                  <div className="mt-1 text-xs text-slate-500">{metricMeta.label} â€¢ {country}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{response?.coverage?.min_year ?? "â€”"}â€“{response?.coverage?.max_year ?? "â€”"}</Badge>
                  <Badge variant="secondary">{response?.coverage?.points ?? 0} points</Badge>
                  {isRefreshing ? <Badge className="bg-violet-600 text-white">Refreshingâ€¦</Badge> : null}
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-4">
              {lineData.length ? (
                <div className="h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineData} margin={{ top: 10, right: 18, left: 8, bottom: 8 }}>
                      <defs>
                        <linearGradient id="energyLine" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#7c3aed" />
                          <stop offset="100%" stopColor="#0ea5e9" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="#64748b" />
                      <YAxis domain={yDomain} tickFormatter={(value) => fmtCompact(Number(value), 1)} tick={{ fontSize: 11 }} stroke="#64748b" />
                      <Tooltip
                        labelFormatter={(label) => `Year: ${label}`}
                        formatter={(value: any) => fmtValue(typeof value === "number" ? value : toNum(value), metricMeta.unit, metricMeta.fmt)}
                      />
                      <Line type="monotone" dataKey="value" stroke="url(#energyLine)" strokeWidth={3} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-[360px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                  No historical series is available for this selection.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="col-span-12 rounded-2xl border-slate-200 bg-white/90 shadow-sm xl:col-span-4">
            <CardHeader className="border-b border-slate-100 pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Factory className="h-5 w-5 text-violet-600" />
                Primary-energy mix
              </CardTitle>
              <div className="text-xs text-slate-500">Latest available shares for {country}</div>
            </CardHeader>

            <CardContent className="pt-4">
              {mixData.length ? (
                <>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={mixData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={98} paddingAngle={2}>
                          {mixData.map((item, index) => (
                            <Cell key={item.name} fill={MIX_COLORS[index % MIX_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any) => `${Number(value).toFixed(2)}%`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    {mixData.map((item, index) => (
                      <div key={item.name} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2">
                        <div className="flex items-center gap-2 text-sm text-slate-700">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: MIX_COLORS[index % MIX_COLORS.length] }} />
                          {item.name}
                        </div>
                        <div className="font-bold text-slate-950">{item.value.toFixed(2)}%</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex h-[320px] items-center justify-center text-center text-sm text-slate-500">
                  Energy-mix shares are not available for this country.
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-12 gap-4">
          <Card className="col-span-12 rounded-2xl border-slate-200 bg-white/90 shadow-sm lg:col-span-7">
            <CardHeader className="border-b border-slate-100 pb-3">
              <CardTitle className="text-base">Country ranking â€¢ {response?.rankYear ?? "â€”"}</CardTitle>
              <div className="text-xs text-slate-500">Top 10 for {metricMeta.label}</div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-950 text-white">
                    <tr>
                      <th className="w-14 px-3 py-2.5 text-left">#</th>
                      <th className="px-3 py-2.5 text-left">Country</th>
                      <th className="px-3 py-2.5 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top10.map((row) => {
                      const active = row.country === country;
                      return (
                        <tr
                          key={`${row.rank}-${row.country}`}
                          onClick={() => setCountry(row.country)}
                          className={`cursor-pointer border-t transition ${active ? "bg-violet-50" : "bg-white hover:bg-slate-50"}`}
                        >
                          <td className="px-3 py-2.5 text-slate-500">{row.rank}</td>
                          <td className="px-3 py-2.5 font-semibold text-slate-900">{row.country}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-slate-800">{fmtValue(toNum(row.value), metricMeta.unit, metricMeta.fmt)}</td>
                        </tr>
                      );
                    })}
                    {!top10.length ? (
                      <tr><td colSpan={3} className="px-3 py-8 text-center text-slate-500">No ranking data is available.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                <Badge variant="secondary">Selected rank: {response?.country_rank ? `#${response.country_rank}` : "not ranked"}</Badge>
                <Badge variant="secondary">Countries: {response?.total_countries ?? "â€”"}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-12 rounded-2xl border-slate-200 bg-white/90 shadow-sm lg:col-span-5">
            <CardHeader className="border-b border-slate-100 pb-3">
              <CardTitle className="text-base">Recent annual values</CardTitle>
              <div className="text-xs text-slate-500">{metricMeta.label} â€¢ latest 12 observations</div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="max-h-[390px] overflow-auto rounded-xl border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-100 text-slate-700">
                    <tr>
                      <th className="px-3 py-2 text-left">Year</th>
                      <th className="px-3 py-2 text-right">Value</th>
                      <th className="px-3 py-2 text-right">YoY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history
                      .slice()
                      .sort((a, b) => b.year - a.year)
                      .slice(0, 12)
                      .map((row) => (
                        <tr key={row.year} className="border-t bg-white">
                          <td className="px-3 py-2 text-slate-600">{row.year}</td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-900">{fmtValue(row.value, metricMeta.unit, metricMeta.fmt)}</td>
                          <td className="px-3 py-2 text-right">
                            <span className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${
                              row.deltaPct === null
                                ? "bg-slate-100 text-slate-500"
                                : row.deltaPct >= 0
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-rose-50 text-rose-700"
                            }`}>
                              {row.deltaPct === null ? "â€”" : `${row.deltaPct >= 0 ? "+" : ""}${row.deltaPct.toFixed(1)}%`}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800">
                Live figures are calculated estimates, not direct real-time meter readings. They use the latest available annual values and your browser&apos;s local clock.
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
