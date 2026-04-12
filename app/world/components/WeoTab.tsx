"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

type Point = {
  year: number;
  value: number;
};

type WeoResponse = {
  ok?: boolean;
  iso3?: string;
  country?: string;
  indicator_code?: string;
  indicator_label?: string;
  vintage?: string | null;
  points?: Array<{
    year: number | string;
    value: number | string;
  }>;
  points_returned?: number;
  error?: string;
};

type Props = {
  iso3: string;
  initialIndicator: string;
};

type PointWithYoY = Point & {
  yoy: number | null;
};

function fmt(value: number) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function fmtYoY(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${fmt(value)}`;
}

export default function WeoTab({ iso3, initialIndicator }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState<WeoResponse | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setError("");
        setPayload(null);

        const res = await fetch(
          `/api/imf/weo/country?iso3=${encodeURIComponent(
            iso3,
          )}&indicator=${encodeURIComponent(initialIndicator)}`,
          { cache: "no-store" },
        );

        const json: WeoResponse = await res.json();

        if (!alive) return;

        if (!res.ok || json.ok === false) {
          setPayload(json);
          setError(json.error || "Failed to load WEO data");
          return;
        }

        setPayload(json);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load WEO data");
        setPayload(null);
      } finally {
        if (alive) setLoading(false);
      }
    }

    if (iso3 && initialIndicator) {
      load();
    }

    return () => {
      alive = false;
    };
  }, [iso3, initialIndicator]);

  const points = useMemo<Point[]>(() => {
    return (payload?.points || [])
      .map((p) => ({
        year: Number(p.year),
        value: Number(p.value),
      }))
      .filter((p) => Number.isFinite(p.year) && Number.isFinite(p.value))
      .sort((a, b) => a.year - b.year);
  }, [payload]);

  const pointsWithYoY = useMemo<PointWithYoY[]>(() => {
    return points.map((point, index) => {
      if (index === 0) return { ...point, yoy: null };
      const prev = points[index - 1];
      return {
        ...point,
        yoy: point.value - prev.value,
      };
    });
  }, [points]);

  const latest = points.length ? points[points.length - 1].value : NaN;
  const minVal = points.length ? Math.min(...points.map((p) => p.value)) : NaN;
  const maxVal = points.length ? Math.max(...points.map((p) => p.value)) : NaN;

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <div className="flex min-w-[240px] flex-col items-center rounded-3xl border border-slate-200 bg-white px-7 py-7 shadow-sm">
          <div className="mb-4 h-10 w-10 animate-spin rounded-full border-[3px] border-slate-200 border-t-slate-900" />
          <div className="text-sm font-semibold text-slate-900">
            Loading IMF WEO...
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Please wait while data is being fetched
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[24px] border border-red-200 bg-red-50 p-6">
        <div className="text-lg font-semibold text-red-700">
          Failed to load WEO data
        </div>
        <div className="mt-2 text-sm text-red-600">{error}</div>
      </div>
    );
  }

  if (!points.length) {
    return (
      <div className="rounded-[24px] border border-slate-200 bg-white p-6">
        <div className="text-base text-slate-700">
          No WEO data found for this country/indicator.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-[26px] font-bold tracking-tight text-slate-900">
          IMF — World Economic Outlook (WEO)
        </h2>

        <div className="mt-1.5 text-base text-slate-500">
          {payload?.indicator_label ||
            payload?.indicator_code ||
            initialIndicator}
        </div>

        <div className="mt-1.5 text-xs text-slate-500">
          {payload?.country || iso3} • {payload?.vintage || "Latest vintage"}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs text-slate-500">Latest</div>
          <div className="mt-2 text-[40px] font-bold tracking-tight text-slate-950">
            {fmt(latest)}
          </div>
        </div>

        <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs text-slate-500">Range (min)</div>
          <div className="mt-2 text-[40px] font-bold tracking-tight text-slate-950">
            {fmt(minVal)}
          </div>
        </div>

        <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs text-slate-500">Range (max)</div>
          <div className="mt-2 text-[40px] font-bold tracking-tight text-slate-950">
            {fmt(maxVal)}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(420px,0.95fr)]">
        <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3">
            <h3 className="text-[20px] font-bold text-slate-900">
              Series trend
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {points.length} returned points
            </p>
          </div>

          <div className="rounded-[24px] border border-slate-100 bg-slate-50/60 p-3">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={points}
                  margin={{ top: 10, right: 14, left: 2, bottom: 4 }}
                >
                  <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="year"
                    stroke="#CBD5E1"
                    tick={{ fill: "#475569", fontSize: 10 }}
                    minTickGap={18}
                  />
                  <YAxis
                    stroke="#CBD5E1"
                    tick={{ fill: "#475569", fontSize: 10 }}
                    width={48}
                    tickFormatter={(v) => fmt(Number(v))}
                  />
                  <Tooltip
                    formatter={(value: number) => [fmt(Number(value)), "Value"]}
                    labelFormatter={(label) => `Year: ${label}`}
                    contentStyle={{
                      borderRadius: 14,
                      border: "1px solid #E2E8F0",
                      background: "#FFFFFF",
                      boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
                      fontSize: "12px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#4F46E5"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3">
            <h3 className="text-[20px] font-bold text-slate-900">
              Returned points
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Value and annual absolute change
            </p>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-slate-200">
            <div className="grid grid-cols-[72px_1fr_1fr] bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
              <div>Year</div>
              <div className="text-right">Value</div>
              <div className="text-right">YoY change</div>
            </div>

            <div className="max-h-[300px] overflow-y-auto">
              {pointsWithYoY.map((point) => (
                <div
                  key={point.year}
                  className="grid grid-cols-[72px_1fr_1fr] border-t border-slate-100 px-4 py-3 text-[13px] text-slate-800"
                >
                  <div className="font-medium">{point.year}</div>

                  <div className="text-right tabular-nums">
                    {fmt(point.value)}
                  </div>

                  <div
                    className={`text-right tabular-nums font-medium ${
                      point.yoy === null
                        ? "text-slate-400"
                        : point.yoy > 0
                          ? "text-emerald-600"
                          : point.yoy < 0
                            ? "text-rose-600"
                            : "text-slate-600"
                    }`}
                  >
                    {fmtYoY(point.yoy)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
