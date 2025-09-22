// components/SeriesChart.tsx
"use client";

import * as React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export type SeriesPoint = { year: number; value: number };

type Props = {
  data: ReadonlyArray<SeriesPoint>;
  height?: number;
  className?: string;
  unit?: string;
  color?: string;
};

// Minimal shape we actually use from Recharts' Tooltip
type MinimalTooltipProps = {
  active?: boolean;
  label?: number | string;
  payload?: Array<{ value?: number | (number | string)[] }>;
};

export default function SeriesChart({
  data,
  height = 240,
  className,
  unit,
  color = "#60a5fa",
}: Props) {
  // Recharts prefers a mutable array
  const chartData: SeriesPoint[] = React.useMemo(() => [...data], [data]);

  const renderTooltip = React.useCallback(
    (p: MinimalTooltipProps) => {
      if (!p?.active || !p.payload?.length) return null;

      const raw = p.payload[0]?.value;
      const val =
        typeof raw === "number"
          ? raw
          : Array.isArray(raw) && typeof raw[0] === "number"
          ? raw[0]
          : Number.NaN;

      return (
        <div className="rounded-md bg-slate-900/95 px-3 py-2 text-sm shadow-lg ring-1 ring-slate-700">
          <div className="font-medium text-slate-100">
            {typeof p.label === "number"
              ? String(p.label)
              : String(p.label ?? "")}
          </div>
          <div className="text-slate-300">
            {Number.isFinite(val) ? val.toLocaleString() : "—"}
            {unit ? ` ${unit}` : ""}
          </div>
        </div>
      );
    },
    [unit]
  );

  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
        >
          <CartesianGrid strokeOpacity={0.15} />
          <XAxis dataKey="year" />
          <YAxis />
          <Tooltip content={renderTooltip} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            dot={false}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
