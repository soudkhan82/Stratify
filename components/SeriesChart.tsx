// components/SeriesChart.tsx (Client Component)
// =============================
"use client";
import type { SeriesPoint } from "@/lib/types/series";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function SeriesChart({
  data,
  unit,
}: {
  data: SeriesPoint[];
  unit?: string;
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 4, right: 12, bottom: 4, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="year" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} domain={["auto", "auto"]} />
          <Tooltip
            formatter={(v: any) =>
              typeof v === "number" ? Intl.NumberFormat().format(v) : v
            }
            labelFormatter={(l) => `Year: ${l}`}
          />
          <Line type="monotone" dataKey="value" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
      {unit && (
        <div className="mt-2 text-xs text-muted-foreground">Unit: {unit}</div>
      )}
    </div>
  );
}
