"use client";

import React, { useEffect, useMemo, useState } from "react";

type WeoPoint = {
  year: number;
  value: number | null;
};

type WeoSeries = {
  indicator_code: string;
  indicator_label: string;
  unit: string | null;
  country: string;
  iso3: string;
  vintage: string;
  points: WeoPoint[];
};

type WeoResponse = {
  ok?: boolean;
  rows?: WeoSeries[];
  error?: string;
};

type Props = {
  iso3: string;
  initialIndicator?: string;
};

async function fetchJsonSafe<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${text.slice(0, 300)}`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    console.error("Non-JSON API response from:", url, text);
    throw new Error("API returned invalid JSON");
  }
}

function fmt(v: number | null | undefined) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return Number(v).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

function LoaderCard() {
  return (
    <div className="flex min-h-[420px] items-center justify-center">
      <div className="flex min-w-[240px] flex-col items-center rounded-3xl border border-slate-200 bg-white px-8 py-8 shadow-sm">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-[3px] border-slate-200 border-t-slate-900" />
        <div className="text-base font-semibold text-slate-900">
          Loading WEO data...
        </div>
        <div className="mt-1 text-sm text-slate-500">
          Please wait while data is being fetched
        </div>
      </div>
    </div>
  );
}

export default function WeoTab({
  iso3,
  initialIndicator = "NGDP_RPCH",
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<WeoSeries[]>([]);
  const [indicatorCode, setIndicatorCode] = useState(initialIndicator);

  useEffect(() => {
    setIndicatorCode(initialIndicator || "NGDP_RPCH");
  }, [initialIndicator]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const json = await fetchJsonSafe<WeoResponse>(
          `/api/imf/weo/country?iso3=${encodeURIComponent(
            iso3,
          )}&indicator=${encodeURIComponent(indicatorCode)}`,
        );

        if (!alive) return;

        if (json.error) {
          throw new Error(json.error);
        }

        setRows(Array.isArray(json.rows) ? json.rows : []);
        console.log("WEO API response:", json);
      } catch (e) {
        if (!alive) return;
        setRows([]);
        setError(e instanceof Error ? e.message : "Failed to load WEO data");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [iso3, indicatorCode]);

  const active = useMemo(() => rows?.[0] ?? null, [rows]);
  const points = active?.points ?? [];
  const validPoints = points.filter((p) => p.value !== null);

  const latest = validPoints.length
    ? validPoints[validPoints.length - 1]
    : null;
  const minValue = validPoints.length
    ? Math.min(...validPoints.map((p) => Number(p.value)))
    : null;
  const maxValue = validPoints.length
    ? Math.max(...validPoints.map((p) => Number(p.value)))
    : null;

  if (loading) {
    return <LoaderCard />;
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
        <div className="text-base font-semibold">Failed to load WEO data</div>
        <div className="mt-1 break-words text-sm">{error}</div>
      </div>
    );
  }

  if (!active) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-600">
        No WEO data found for this country/indicator.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">
          IMF — World Economic Outlook (WEO)
        </h2>
        <p className="mt-1 text-sm text-slate-500">{active.indicator_label}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ["NGDP_RPCH", "GDP growth"],
          ["NGDPD", "GDP, current prices"],
          ["PCPIPCH", "Inflation"],
          ["LUR", "Unemployment"],
          ["BCA", "Current account balance"],
          ["GGXONLB_NGDP", "Govt net lending/borrowing"],
        ].map(([code, label]) => {
          const isActive = indicatorCode === code;
          return (
            <button
              key={code}
              onClick={() => setIndicatorCode(code)}
              className={
                isActive
                  ? "rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              }
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Latest</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {fmt(latest?.value)}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {active.unit || "Unit"}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Range (min)</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {fmt(minValue)}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {active.unit || "Unit"}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Range (max)</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {fmt(maxValue)}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {active.unit || "Unit"}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 text-lg font-semibold text-slate-900">
          Diagnostic summary
        </div>
        <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
          <div>
            <span className="font-semibold">ISO3:</span> {iso3}
          </div>
          <div>
            <span className="font-semibold">Indicator code:</span>{" "}
            {active.indicator_code}
          </div>
          <div>
            <span className="font-semibold">Indicator label:</span>{" "}
            {active.indicator_label}
          </div>
          <div>
            <span className="font-semibold">Vintage:</span>{" "}
            {active.vintage || "—"}
          </div>
          <div>
            <span className="font-semibold">Country:</span> {active.country}
          </div>
          <div>
            <span className="font-semibold">Points returned:</span>{" "}
            {points.length}
          </div>
          <div>
            <span className="font-semibold">Valid numeric points:</span>{" "}
            {validPoints.length}
          </div>
          <div>
            <span className="font-semibold">Unit:</span> {active.unit || "—"}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 text-lg font-semibold text-slate-900">
          Returned points
        </div>

        {points.length === 0 ? (
          <div className="text-sm text-slate-500">No points returned.</div>
        ) : (
          <div className="max-h-[360px] overflow-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Year</th>
                  <th className="px-4 py-3 text-left font-semibold">Value</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.year} className="border-t border-slate-100">
                    <td className="px-4 py-3">{p.year}</td>
                    <td className="px-4 py-3">{fmt(p.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
