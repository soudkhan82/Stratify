"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CompanyFinancialSnapshot } from "../_lib/corporateTypes";
import { formatCompactCurrency } from "../_lib/corporateFormatters";

type Props = {
  rows: CompanyFinancialSnapshot[];
  loading: boolean;
};

export default function TopCompaniesChart({ rows, loading }: Props) {
  const data = rows
    .filter((row) => typeof row.market_cap === "number")
    .sort((a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0))
    .slice(0, 10)
    .map((row) => ({
      symbol: row.symbol,
      marketCap: row.market_cap ?? 0,
    }));

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-lg font-bold text-slate-950">Top Companies by Market Cap</h2>
        <p className="text-xs text-slate-500">Largest companies in the selected view</p>
      </div>

      <div className="h-80">
        {loading ? (
          <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-500">
            Loading chart...
          </div>
        ) : data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="symbol" tickLine={false} axisLine={false} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatCompactCurrency(Number(value))}
              />
              <Tooltip
                formatter={(value) => [
                  formatCompactCurrency(Number(value)),
                  "Market Cap",
                ]}
              />
              <Bar dataKey="marketCap" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-500">
            No market cap data available.
          </div>
        )}
      </div>
    </div>
  );
}
