// components/IndicatorLine.tsx
"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { METRICS, type MetricKey } from "@/lib/metrics";
import { fetchSeries } from "@/lib/datasources";
import type { SeriesPoint } from "@/lib/types/series";

const fmtCompact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const formatCompact = (n: number) => fmtCompact.format(n);

export function IndicatorLine({
  iso3,
  metric,
  countryLabel,
  className,
}: {
  iso3: string;
  metric: MetricKey;
  countryLabel: string;
  className?: string;
}) {
  const [data, setData] = useState<SeriesPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const m = METRICS[metric];

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const series = await fetchSeries(m.toSpec(iso3));
        if (!cancel) setData(series);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [iso3, metric, m]);

  return (
    <div
      className={`rounded-xl border border-slate-800 bg-slate-900 p-3 ${
        className ?? ""
      }`}
    >
      <div className="mb-1 text-sm font-semibold text-slate-100">
        {m.label} — {countryLabel}{" "}
        <span className="text-slate-400">({m.unit})</span>
      </div>
      <div className="mb-2 text-xs text-slate-400">
        Source: {m.source} • Code: {m.code}
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-10">Loading…</div>
      ) : data.length ? (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.65} />
                  <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.06} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
              <XAxis
                dataKey="year"
                tickMargin={6}
                stroke="#94a3b8"
                tick={{ fill: "#cbd5e1", fontSize: 12 }}
              />
              <YAxis
                stroke="#94a3b8"
                tick={{ fill: "#cbd5e1", fontSize: 12 }}
                tickFormatter={(v) => formatCompact(v as number)}
              />
              <Tooltip
                contentStyle={{
                  background: "#0f172a",
                  border: "1px solid #1f2937",
                  color: "#e2e8f0",
                }}
                labelStyle={{ color: "#94a3b8" }}
                formatter={(v) => formatCompact(v as number)}
              />
              <Legend wrapperStyle={{ color: "#cbd5e1" }} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#93c5fd"
                fill="url(#areaFill)"
                name={countryLabel}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="text-center text-slate-400 py-10">No data.</div>
      )}
    </div>
  );
}
