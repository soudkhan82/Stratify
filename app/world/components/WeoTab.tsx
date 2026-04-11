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
};

function fmtNum(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function LoaderCard() {
  return (
    <div className="flex min-h-[520px] items-center justify-center">
      <div className="flex min-w-[260px] flex-col items-center rounded-3xl border border-slate-200 bg-white px-8 py-8 shadow-sm">
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

export default function WeoTab({ iso3 }: Props) {
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<WeoSeries[]>([]);

  const [indicatorCode, setIndicatorCode] = useState("NGDP_RPCH");

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/weo/country?iso3=${encodeURIComponent(
            iso3,
          )}&indicator=${encodeURIComponent(indicatorCode)}`,
          { cache: "no-store" },
        );

        const text = await res.text();
        const json: WeoResponse = text ? JSON.parse(text) : {};

        if (!res.ok) {
          throw new Error(json?.error || `Request failed: ${res.status}`);
        }

        if (!alive) return;

        setRows(Array.isArray(json.rows) ? json.rows : []);
      } catch (e: any) {
        if (!alive) return;
        setRows([]);
        setError(e?.message || "Failed to load WEO data");
      } finally {
        if (!alive) return;
        setLoading(false);
        setLoadedOnce(true);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [iso3, indicatorCode]);

  const active = useMemo(() => rows?.[0] ?? null, [rows]);

  const points = useMemo(() => active?.points ?? [], [active]);

  const validPoints = useMemo(
    () => points.filter((p) => p.value !== null && p.value !== undefined),
    [points],
  );

  const latest = validPoints.length
    ? validPoints[validPoints.length - 1]
    : null;
  const previous =
    validPoints.length > 1 ? validPoints[validPoints.length - 2] : null;

  const yoy =
    latest && previous && latest.value !== null && previous.value !== null
      ? latest.value - previous.value
      : null;

  const minVal = validPoints.length
    ? Math.min(...validPoints.map((p) => Number(p.value)))
    : null;

  const maxVal = validPoints.length
    ? Math.max(...validPoints.map((p) => Number(p.value)))
    : null;

  if (loading || !loadedOnce) {
    return <LoaderCard />;
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
        <div className="text-base font-semibold">Failed to load WEO data</div>
        <div className="mt-1 text-sm">{error}</div>
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
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              IMF — World Economic Outlook (WEO)
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {active.indicator_label}
            </p>
          </div>

          <div className="text-sm text-slate-500">
            Vintage: {active.vintage || "—"}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 p-5">
            <div className="text-sm text-slate-500">Latest</div>
            <div className="mt-2 text-3xl font-bold text-slate-900">
              {fmtNum(latest?.value)}
            </div>
            <div className="mt-1 text-sm text-slate-500">
              {active.unit || "Unit"}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 p-5">
            <div className="text-sm text-slate-500">YoY change</div>
            <div className="mt-2 text-3xl font-bold text-slate-900">
              {fmtNum(yoy)}
            </div>
            <div className="mt-1 text-sm text-slate-500">
              {active.unit || "Unit"}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 p-5">
            <div className="text-sm text-slate-500">Range (min)</div>
            <div className="mt-2 text-3xl font-bold text-slate-900">
              {fmtNum(minVal)}
            </div>
            <div className="mt-1 text-sm text-slate-500">
              {active.unit || "Unit"}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 p-5">
            <div className="text-sm text-slate-500">Range (max)</div>
            <div className="mt-2 text-3xl font-bold text-slate-900">
              {fmtNum(maxVal)}
            </div>
            <div className="mt-1 text-sm text-slate-500">
              {active.unit || "Unit"}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            ["NGDP_RPCH", "GDP growth"],
            ["NGDPD", "GDP current prices"],
            ["PCPIPCH", "Inflation"],
            ["LUR", "Unemployment"],
            ["BCA", "Current account"],
          ].map(([code, label]) => {
            const activeBtn = indicatorCode === code;
            return (
              <button
                key={code}
                onClick={() => setIndicatorCode(code)}
                className={
                  activeBtn
                    ? "rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                    : "rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                }
              >
                {label}
              </button>
            );
          })}
        </div>

        {validPoints.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
            No usable WEO values were returned for this indicator.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Year</th>
                  <th className="px-4 py-3 text-left font-semibold">Value</th>
                </tr>
              </thead>
              <tbody>
                {validPoints
                  .slice()
                  .reverse()
                  .map((p) => (
                    <tr key={p.year} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-slate-700">{p.year}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {fmtNum(p.value)}
                      </td>
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
