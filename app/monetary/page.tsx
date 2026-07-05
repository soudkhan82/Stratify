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

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

type IndicatorRow = {
  code: string;
  label: string;
  category: string;
  unit: string | null;
  latestYear: number | null;
  latestValue: number | null;
  countryIso3: string;
  countryName: string;
  source: string;
  sourceUrl?: string | null;
  availablePoints: number;
  firstAvailableYear: number | null;
  lastAvailableYear: number | null;
  series?: Array<{
    year: number;
    value: number | null;
  }>;
};

type MonetaryResp = {
  ok: boolean;
  error?: string;
  module: string;
  title: string;
  source_mode: string;
  primary_source: string;
  country: string;
  compact: boolean;
  coverage: {
    requested_indicators: number;
    available_latest_values: number;
    missing_latest_values: number;
  };
  kpis: Record<string, IndicatorRow | null>;
  groups: Record<string, IndicatorRow[]>;
  indicators: IndicatorRow[];
  generated_at: string;
};

type CountryOption = {
  code: string;
  name: string;
  iso2?: string;
  region?: string;
  regionCode?: string;
  incomeLevel?: string;
  capitalCity?: string;
  type: "country" | "region";
};

type CountriesResp = {
  ok: boolean;
  regions: CountryOption[];
  countries: CountryOption[];
};

const FALLBACK_REGIONS: CountryOption[] = [
  { code: "WLD", name: "World", type: "region" },
  { code: "SSF", name: "Sub-Saharan Africa", type: "region" },
  { code: "ECS", name: "Europe & Central Asia", type: "region" },
  { code: "MEA", name: "Middle East & North Africa", type: "region" },
  { code: "SAS", name: "South Asia", type: "region" },
  { code: "EAS", name: "East Asia & Pacific", type: "region" },
  { code: "LCN", name: "Latin America & Caribbean", type: "region" },
  { code: "NAC", name: "North America", type: "region" },
];

const FALLBACK_COUNTRIES: CountryOption[] = [
  { code: "PAK", name: "Pakistan", regionCode: "SAS", region: "South Asia", type: "country" },
  { code: "USA", name: "United States", regionCode: "NAC", region: "North America", type: "country" },
  { code: "CHN", name: "China", regionCode: "EAS", region: "East Asia & Pacific", type: "country" },
  { code: "IND", name: "India", regionCode: "SAS", region: "South Asia", type: "country" },
  { code: "GBR", name: "United Kingdom", regionCode: "ECS", region: "Europe & Central Asia", type: "country" },
  { code: "DEU", name: "Germany", regionCode: "ECS", region: "Europe & Central Asia", type: "country" },
  { code: "FRA", name: "France", regionCode: "ECS", region: "Europe & Central Asia", type: "country" },
  { code: "JPN", name: "Japan", regionCode: "EAS", region: "East Asia & Pacific", type: "country" },
  { code: "SAU", name: "Saudi Arabia", regionCode: "MEA", region: "Middle East & North Africa", type: "country" },
  { code: "ARE", name: "United Arab Emirates", regionCode: "MEA", region: "Middle East & North Africa", type: "country" },
  { code: "TUR", name: "Turkiye", regionCode: "ECS", region: "Europe & Central Asia", type: "country" },
];

const DEFAULT_INDICATOR = "FR.INR.LEND";

async function fetchJson(url: string, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });

    const txt = await res.text().catch(() => "");

    if (!res.ok) {
      throw new Error(
        `HTTP ${res.status} ${res.statusText}${txt ? ` - ${txt.slice(0, 220)}` : ""}`,
      );
    }

    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      throw new Error(
        `Expected JSON but got "${ct || "unknown"}"${txt ? ` - ${txt.slice(0, 220)}` : ""}`,
      );
    }

    return JSON.parse(txt);
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error("Request timed out. Please retry or select another country.");
    }

    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n =
    typeof v === "number"
      ? v
      : Number(String(v).replaceAll(",", "").trim());
  return Number.isFinite(n) ? n : null;
}

function fmtCompact(n: number | null | undefined) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function fmtVal(v: number | null | undefined, unit?: string | null) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "-";

  const base =
    Math.abs(v) >= 1e6
      ? fmtCompact(v)
      : v.toLocaleString("en-US", { maximumFractionDigits: 2 });

  if (!unit) return base;
  if (unit === "%") return `${base}%`;
  if (unit === "annual %") return `${base}%`;
  if (unit === "% of GDP") return `${base}%`;
  if (unit === "current US$") return `$${base}`;
  if (unit === "LCU per US$") return `${base}`;

  return `${base} ${unit}`;
}

function fmtTableVal(v: number | null | undefined, unit?: string | null) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "-";

  const base =
    Math.abs(v) >= 1e6
      ? fmtCompact(v)
      : v.toLocaleString("en-US", { maximumFractionDigits: 2 });

  if (!unit) return base;
  if (unit === "%") return `${base}%`;
  if (unit === "annual %") return `${base}%`;
  if (unit === "% of GDP") return `${base}%`;
  if (unit === "% of total gross loans") return `${base}%`;
  if (unit === "current US$") return `$${base}`;
  if (unit === "LCU per US$") return base;
  if (unit === "count") return base;
  if (unit === "months") return `${base} mo`;

  return base;
}

function safeText(value: string, max = 68) {
  const t = String(value || "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}...`;
}

function cleanSeries(row: IndicatorRow | null | undefined) {
  return (row?.series ?? [])
    .map((p) => ({ year: Number(p.year), value: toNum(p.value) }))
    .filter((p) => Number.isFinite(p.year) && p.value !== null)
    .map((p) => ({ year: p.year, value: p.value as number }))
    .sort((a, b) => a.year - b.year);
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

function yoyTable(series: { year: number; value: number }[]) {
  return series.map((cur, idx) => {
    const prev = idx > 0 ? series[idx - 1] : null;
    const delta = prev ? cur.value - prev.value : null;
    const deltaPct =
      prev && prev.value !== 0
        ? ((cur.value - prev.value) / Math.abs(prev.value)) * 100
        : null;

    return { year: cur.year, value: cur.value, delta, deltaPct };
  });
}

function uniqueOptions(rows: CountryOption[]) {
  const map = new Map<string, CountryOption>();

  for (const row of rows) {
    if (!row.code) continue;
    if (!map.has(row.code)) map.set(row.code, row);
  }

  return Array.from(map.values());
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-[calc(100vh-72px)] max-w-[1480px] items-center justify-center px-4 py-8">
        <div className="rounded-[26px] border border-slate-200 bg-white px-10 py-8 text-center shadow-sm">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-violet-600" />
          <h2 className="text-xl font-black text-slate-950">
            Loading monetary intelligence
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Fetching countries, indicators, and latest series...
          </p>
        </div>
      </div>
    </div>
  );
}

function PageLoadingBar({ loading }: { loading: boolean }) {
  if (!loading) return null;

  return (
    <div className="fixed left-0 right-0 top-[72px] z-40 h-1 overflow-hidden bg-violet-100">
      <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-violet-600 to-blue-600" />
    </div>
  );
}

function MetricCard({
  title,
  row,
  icon,
}: {
  title: string;
  row: IndicatorRow | null | undefined;
  icon: string;
}) {
  return (
    <Card className="rounded-[22px] border border-slate-200 bg-white shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-slate-500">{title}</div>
            <div className="mt-2 text-2xl font-black text-slate-950">
              {fmtVal(row?.latestValue, row?.unit)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {row?.latestYear ? `Year ${row.latestYear}` : "No latest value"}
            </div>
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-lg">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MonetaryPage() {
  const [country, setCountry] = useState("PAK");
  const [regionFilter, setRegionFilter] = useState("WLD");
  const [indicatorCode, setIndicatorCode] = useState(DEFAULT_INDICATOR);

  const [regions, setRegions] = useState<CountryOption[]>(FALLBACK_REGIONS);
  const [countries, setCountries] = useState<CountryOption[]>(FALLBACK_COUNTRIES);

  const [resp, setResp] = useState<MonetaryResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const j = (await fetchJson("/api/monetary/countries", 20000)) as CountriesResp;

        if (!alive) return;

        if (j.ok) {
          if (Array.isArray(j.regions) && j.regions.length) setRegions(j.regions);
          if (Array.isArray(j.countries) && j.countries.length) setCountries(j.countries);
        }
      } catch {
        if (!alive) return;
        setRegions(FALLBACK_REGIONS);
        setCountries(FALLBACK_COUNTRIES);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);

      try {
        const j = (await fetchJson(
          `/api/monetary/overview?country=${encodeURIComponent(country)}&series=1`,
          30000,
        )) as MonetaryResp;

        if (!alive) return;

        if (!j.ok) {
          throw new Error(j.error || "Monetary API returned ok=false");
        }

        setResp(j);

        const currentRow =
          j.indicators?.find((x) => x.code === indicatorCode) || null;

        const currentHasSeries =
          currentRow ? cleanSeries(currentRow).length >= 2 : false;

        const firstWithSeries =
          j.indicators?.find((x) => cleanSeries(x).length >= 2) || null;

        const firstWithLatest =
          j.indicators?.find((x) => x.latestValue !== null) || null;

        const fallbackIndicator =
          firstWithSeries || firstWithLatest || j.indicators?.[0] || null;

        if (
          !currentHasSeries &&
          fallbackIndicator?.code &&
          fallbackIndicator.code !== indicatorCode
        ) {
          setIndicatorCode(fallbackIndicator.code);
        }
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Failed to load monetary data");
      } finally {
        if (alive) {
          setLoading(false);
          setInitialLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country]);

  const regionOptions = useMemo(() => regions, [regions]);

  const countryOptions = useMemo(() => {
    if (regionFilter === "WLD") return uniqueOptions(countries);

    return uniqueOptions(
      countries.filter((c) => c.regionCode === regionFilter),
    );
  }, [regionFilter, countries]);

  const indicators = resp?.indicators ?? [];

  const selected = useMemo(() => {
    const current = indicators.find((x) => x.code === indicatorCode) || null;

    if (current && cleanSeries(current).length >= 2) return current;

    return (
      indicators.find((x) => cleanSeries(x).length >= 2) ||
      indicators.find((x) => x.latestValue !== null) ||
      current ||
      indicators[0] ||
      null
    );
  }, [indicators, indicatorCode]);

  const selectedSeries = useMemo(() => cleanSeries(selected), [selected]);
  const table = useMemo(() => yoyTable(selectedSeries), [selectedSeries]);

  const lineData = useMemo(() => {
    const take = 40;
    return table.slice(Math.max(0, table.length - take));
  }, [table]);

  const yDomain = useMemo(() => {
    return yPadDomain(lineData.map((d) => d.value));
  }, [lineData]);

  const latest = selectedSeries.length
    ? selectedSeries[selectedSeries.length - 1]
    : null;

  const latestDelta = table.length >= 2 ? table[table.length - 1].delta : null;

  const selectedCountryOption =
    countryOptions.find((c) => c.code === country) ||
    countries.find((c) => c.code === country);

  const countryLabel =
    selected?.countryName ||
    selectedCountryOption?.name ||
    country;

  const categoryRows = useMemo(() => {
    const entries = Object.entries(resp?.groups ?? {}).map(([category, rows]) => {
      const available = rows.filter((r) => r.latestValue !== null).length;
      return { category, total: rows.length, available };
    });

    return entries.sort((a, b) => b.total - a.total);
  }, [resp]);

  const maxCategory = Math.max(1, ...categoryRows.map((x) => x.total));

  if (initialLoading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-slate-100">
      <PageLoadingBar loading={loading} />

      <div className="mx-auto max-w-[1480px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              WORLDSTATS360
            </div>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">
              Monetary & Financial Stability
            </h1>
            <p className="mt-1 max-w-4xl text-sm text-slate-600">
              Country-level monetary intelligence covering money supply,
              interest rates, exchange rates, FX reserves, banking health, and
              capital markets.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={regionFilter}
              onValueChange={(value) => {
                setRegionFilter(value);

                const nextCountries =
                  value === "WLD"
                    ? countries
                    : countries.filter((c) => c.regionCode === value);

                const currentStillValid = nextCountries.find(
                  (c) => c.code === country,
                );

                const preferred =
                  currentStillValid ||
                  nextCountries.find((c) => c.code === "PAK") ||
                  nextCountries[0];

                if (preferred?.code) setCountry(preferred.code);
              }}
            >
              <SelectTrigger className="w-[250px] rounded-2xl border-slate-200 bg-slate-50 font-bold shadow-sm">
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent className="max-h-[380px]">
                {regionOptions.map((r) => (
                  <SelectItem key={r.code} value={r.code}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className="w-[310px] rounded-2xl border-slate-200 bg-slate-50 font-bold shadow-sm">
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent className="max-h-[420px]">
                {countryOptions.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={indicatorCode} onValueChange={setIndicatorCode}>
              <SelectTrigger className="w-[340px] rounded-2xl border-slate-200 bg-slate-50 font-bold shadow-sm">
                <SelectValue placeholder="Indicator" />
              </SelectTrigger>
              <SelectContent className="max-h-[380px]">
                {indicators.map((m) => (
                  <SelectItem key={m.code} value={m.code}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              className="rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 font-black text-white shadow-md shadow-violet-200 hover:opacity-95"
              onClick={() => {
                setRegionFilter("WLD");
                setCountry("PAK");
                setIndicatorCode(DEFAULT_INDICATOR);
              }}
            >
              Reset
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-[18px] border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-bold text-violet-700">
            Loading latest monetary data for {countryLabel}...
          </div>
        ) : null}

        {err ? (
          <div className="rounded-[20px] border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
            {err}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <MetricCard title="Money Supply" row={resp?.kpis?.money_supply} icon="💰" />
          <MetricCard title="Lending Rate" row={resp?.kpis?.lending_rate} icon="📈" />
          <MetricCard title="Exchange Rate" row={resp?.kpis?.exchange_rate} icon="💱" />
          <MetricCard title="FX Reserves" row={resp?.kpis?.total_reserves} icon="🏦" />
        </div>

        <Card className="rounded-[24px] border border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-2xl font-black text-slate-950">
                  Indicator Coverage
                </CardTitle>
                <p className="text-sm text-slate-500">
                  Monetary dataset sections and available indicator groups.
                </p>
              </div>

              <Badge className="rounded-full bg-slate-100 px-3 py-1 font-black text-slate-700 hover:bg-slate-100">
                {resp?.coverage?.available_latest_values ?? 0} available
              </Badge>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {categoryRows.map((row) => (
                <div
                  key={row.category}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-black text-slate-900">
                      {row.category}
                    </span>
                    <span className="text-sm font-black text-slate-950">
                      {row.total}
                    </span>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-600 to-blue-600"
                      style={{
                        width: `${Math.max(
                          6,
                          Math.round((row.total / maxCategory) * 100),
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="mt-2 text-[11px] font-semibold text-slate-500">
                    {row.available} with latest values
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-12 gap-4">
          <Card className="col-span-12 rounded-[24px] border border-slate-200 bg-white shadow-sm lg:col-span-7">
            <CardHeader className="pb-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-2xl font-black text-slate-950">
                    Monetary Trend
                  </CardTitle>
                  <p className="text-sm text-slate-500">
                    {safeText(selected?.label || "", 120)}{" "}
                    {selected?.unit ? `- ${selected.unit}` : ""} - {countryLabel}
                  </p>
                </div>

                <Badge variant="secondary" className="rounded-full">
                  {selected?.firstAvailableYear ?? "-"}-
                  {selected?.lastAvailableYear ?? "-"}
                </Badge>
              </div>
            </CardHeader>

            <CardContent>
              {!table.length ? (
                <div className="rounded-2xl border bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  No series available for this indicator.
                </div>
              ) : (
                <>
                  <div className="h-[370px] rounded-2xl border bg-white p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={lineData}
                        margin={{ left: 8, right: 16, top: 12, bottom: 8 }}
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
                              selected?.unit,
                            )
                          }
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#4f46e5"
                          strokeWidth={3}
                          dot={false}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-2 text-xs text-slate-500">
                    Showing last {Math.min(40, lineData.length)} points -{" "}
                    {selected?.code ?? "-"}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="col-span-12 rounded-[24px] border border-slate-200 bg-white shadow-sm lg:col-span-5">
            <CardHeader className="pb-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-2xl font-black text-slate-950">
                    Monetary Indicator Table
                  </CardTitle>
                  <p className="text-sm text-slate-500">
                    Click any row to update the trend chart.
                  </p>
                </div>

                <Badge className="rounded-full bg-slate-100 px-3 py-1 font-black text-slate-700 hover:bg-slate-100">
                  {indicators.length} indicators
                </Badge>
              </div>
            </CardHeader>

            <CardContent>
              <div className="max-h-[430px] overflow-y-auto overflow-x-hidden rounded-2xl border border-slate-200 bg-white">
                <table className="w-full table-fixed text-[12px]">
                  <colgroup>
                    <col className="w-[58%]" />
                    <col className="w-[27%]" />
                    <col className="w-[15%]" />
                  </colgroup>
                  <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] text-slate-600">
                    <tr>
                      <th className="px-2 py-2 text-left">Indicator</th>
                      <th className="px-2 py-2 text-right">Value</th>
                      <th className="px-2 py-2 text-right">Year</th>
                    </tr>
                  </thead>

                  <tbody>
                    {indicators.map((row) => {
                      const active = row.code === selected?.code;

                      return (
                        <tr
                          key={row.code}
                          className={[
                            "cursor-pointer border-t transition",
                            active ? "bg-violet-50" : "hover:bg-slate-50",
                          ].join(" ")}
                          onClick={() => setIndicatorCode(row.code)}
                        >
                          <td className="px-2 py-2 align-top">
                            <div className="break-words text-[12px] font-black leading-snug text-slate-950">
                              {row.label}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1 leading-tight">
                              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
                                {row.category}
                              </span>
                              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-500">
                                {row.code}
                              </span>
                            </div>
                          </td>

                          <td className="px-2 py-2 align-top text-right text-[12px] font-black leading-snug text-slate-950 break-words">
                            {fmtTableVal(row.latestValue, row.unit)}
                          </td>

                          <td className="px-2 py-2 align-top text-right text-[12px] text-slate-700">
                            {row.latestYear ?? "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-[24px] border border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl font-black text-slate-950">
              Yearly Detail
            </CardTitle>
            <p className="text-sm text-slate-500">
              Year-wise values and change for the selected indicator.
            </p>
          </CardHeader>

          <CardContent>
            <div className="max-h-[360px] overflow-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th className="p-3 text-left">Year</th>
                    <th className="px-2 py-2 text-right">Value</th>
                    <th className="p-3 text-right">Change</th>
                    <th className="p-3 text-right">Change %</th>
                  </tr>
                </thead>

                <tbody>
                  {table
                    .slice()
                    .sort((a, b) => b.year - a.year)
                    .map((r) => (
                      <tr key={r.year} className="border-t hover:bg-slate-50">
                        <td className="p-3 font-semibold text-slate-700">
                          {r.year}
                        </td>
                        <td className="px-2 py-2 align-top text-right text-[12px] font-black leading-snug text-slate-950 break-words">
                          {fmtVal(r.value, selected?.unit)}
                        </td>
                        <td className="p-3 text-right font-semibold text-slate-700">
                          {r.delta === null
                            ? "-"
                            : fmtVal(r.delta, selected?.unit)}
                        </td>
                        <td className="p-3 text-right">
                          <span
                            className={[
                              "inline-flex rounded-full border px-2 py-0.5 text-xs font-black",
                              r.deltaPct === null
                                ? "border-slate-200 bg-slate-50 text-slate-500"
                                : r.deltaPct >= 0
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-rose-200 bg-rose-50 text-rose-700",
                            ].join(" ")}
                          >
                            {r.deltaPct === null
                              ? "-"
                              : `${r.deltaPct.toFixed(1)}%`}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

