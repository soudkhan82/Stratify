"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

/* =======================
   Types
======================= */

export type WdiPoint = { year: number; value: number; unit?: string | null };

export type WdiResponse = {
  iso3: string;
  country: string;
  region: string | null;
  indicator: { code: string; label: string; unit: string | null };
  latest: WdiPoint | null;
  series: WdiPoint[];
  error?: string;
};

/* =======================
   Helpers (export parse)
======================= */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function asNullableString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

export function parseWdiResponse(
  raw: unknown,
  iso3: string,
  indicator: string,
): WdiResponse {
  if (!isRecord(raw)) {
    return {
      iso3,
      country: iso3,
      region: null,
      indicator: { code: indicator, label: indicator, unit: null },
      latest: null,
      series: [],
      error: "Invalid WDI API response (not an object).",
    };
  }

  const maybeErr = raw.error;
  if (typeof maybeErr === "string" && maybeErr.trim()) {
    return {
      iso3,
      country: iso3,
      region: null,
      indicator: { code: indicator, label: indicator, unit: null },
      latest: null,
      series: [],
      error: maybeErr,
    };
  }

  const country = asString(raw.country, iso3);
  const region = asNullableString(raw.region);

  const ind = isRecord(raw.indicator) ? raw.indicator : {};
  const code = asString(ind.code, indicator);
  const label = asString(ind.label, indicator);
  const unit = (typeof ind.unit === "string" ? ind.unit : null) as
    | string
    | null;

  const latestRaw = isRecord(raw.latest) ? raw.latest : null;
  const latest: WdiPoint | null =
    latestRaw &&
    asNumber(latestRaw.year) !== null &&
    asNumber(latestRaw.value) !== null
      ? {
          year: asNumber(latestRaw.year)!,
          value: asNumber(latestRaw.value)!,
          unit: typeof latestRaw.unit === "string" ? latestRaw.unit : null,
        }
      : null;

  const seriesRaw = Array.isArray(raw.series) ? raw.series : [];
  const series = seriesRaw
    .map((r): WdiPoint | null => {
      if (!isRecord(r)) return null;
      const y = asNumber(r.year);
      const v = asNumber(r.value);
      if (y === null || v === null) return null;
      return {
        year: y,
        value: v,
        unit: typeof r.unit === "string" ? r.unit : null,
      };
    })
    .filter((x): x is WdiPoint => x !== null);

  return {
    iso3,
    country,
    region,
    indicator: { code, label, unit },
    latest,
    series,
  };
}

/* =======================
   Formatting
======================= */

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US").format(n);
}
function fmtCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const v = n as number;
  if (Math.abs(v) >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(2)}K`;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}
function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}
function toFiniteNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function tooltipNumber(v: unknown): string {
  const n = toFiniteNumber(v);
  if (n === null) return "—";
  return n.toLocaleString();
}
function stableColorFromKey(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 72% 45%)`;
}

function qsSet(
  routerReplace: (url: string) => void,
  iso3: string,
  code: string,
) {
  routerReplace(`/world/country/${iso3}?indicator=${encodeURIComponent(code)}`);
}

export default function WdiTab(props: {
  iso3: string;
  indicator: string;
  wdi: WdiResponse | null;
  loading: boolean;
}) {
  const router = useRouter();

  const quickPicks = useMemo(
    () => [
      { label: "Population", code: "SP.POP.TOTL" },
      { label: "GDP (current US$)", code: "NY.GDP.MKTP.CD" },
      { label: "Population density", code: "EN.POP.DNST" },
      { label: "Life expectancy", code: "SP.DYN.LE00.IN" },
      { label: "Unemployment (%)", code: "SL.UEM.TOTL.ZS" },
    ],
    [],
  );

  const wdiLatest = props.wdi?.latest ?? null;

  const wdiTable = useMemo(() => {
    const series = (props.wdi?.series ?? [])
      .slice()
      .sort((a, b) => a.year - b.year)
      .map((p) => ({ year: p.year, value: p.value }));

    return series.map((cur, idx) => {
      const prev = idx > 0 ? series[idx - 1] : null;
      const yoy =
        prev && prev.value !== 0 && Number.isFinite(prev.value)
          ? ((cur.value - prev.value) / Math.abs(prev.value)) * 100
          : null;

      return { year: cur.year, value: cur.value, yoy };
    });
  }, [props.wdi]);

  const wdiBars = useMemo(() => {
    if (!wdiTable.length) return [];
    const take = 25;
    return wdiTable.slice(Math.max(0, wdiTable.length - take));
  }, [wdiTable]);

  return (
    <div className="space-y-3">
      <Card className="shadow-sm">
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-semibold text-slate-800">
            Quick indicator picks
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            {quickPicks.map((p) => {
              const active =
                (props.wdi?.indicator?.code ?? props.indicator) === p.code;
              return (
                <button
                  key={p.code}
                  onClick={() => qsSet(router.replace, props.iso3, p.code)}
                  className={[
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    active
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 hover:bg-slate-50",
                  ].join(" ")}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold text-slate-800">
              Latest
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xs text-slate-500">
              {wdiLatest ? `${wdiLatest.year}` : "—"}
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {wdiLatest ? fmt(wdiLatest.value) : "—"}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {props.wdi?.indicator?.unit ?? ""}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm md:col-span-2">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold text-slate-800">
              Trend (Bar) + YoY%
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {props.loading ? (
              <div className="rounded-lg border bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Loading WDI…
              </div>
            ) : wdiTable.length === 0 ? (
              <div className="rounded-lg border bg-slate-50 px-3 py-2 text-xs text-slate-600">
                No WDI series for this indicator / country.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={wdiBars}
                      margin={{ left: 8, right: 8, top: 10, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis tickFormatter={(v) => fmtCompact(Number(v))} />
                      <Tooltip
                        labelFormatter={(l) => `Year: ${l}`}
                        formatter={(v: any) => tooltipNumber(v)}
                      />
                      <Bar
                        dataKey="value"
                        radius={[8, 8, 0, 0]}
                        fill={stableColorFromKey(props.indicator)}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="rounded-lg border overflow-auto max-h-[300px]">
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
                          YoY%
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {wdiTable
                        .slice()
                        .sort((a, b) => b.year - a.year)
                        .map((r) => (
                          <tr key={r.year} className="border-t">
                            <td className="px-3 py-2 text-slate-700">
                              {r.year}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-slate-900">
                              {fmt(r.value)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span
                                className={[
                                  "inline-flex rounded-full border px-2 py-0.5 font-semibold",
                                  r.yoy === null
                                    ? "border-slate-200 text-slate-500"
                                    : r.yoy >= 0
                                      ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                                      : "border-rose-200 text-rose-700 bg-rose-50",
                                ].join(" ")}
                              >
                                {r.yoy === null ? "—" : fmtPct(r.yoy)}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
