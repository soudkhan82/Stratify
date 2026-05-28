import type { CompanyFinancialSnapshot } from "../_lib/corporateTypes";
import {
  formatCompactCurrency,
  formatNumber,
  formatPercent,
} from "../_lib/corporateFormatters";

type Props = {
  rows: CompanyFinancialSnapshot[];
  loading: boolean;
};

export default function CompanyTable({ rows, loading }: Props) {
  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50">
        <div className="rounded-2xl bg-slate-900 px-5 py-4 text-center text-white shadow-lg">
          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <p className="text-sm font-bold">Loading dashboard...</p>
          <p className="text-xs text-white/70">Fetching corporate intelligence data</p>
        </div>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
        <p className="text-sm font-bold text-slate-700">No companies found</p>
        <p className="mt-1 text-xs text-slate-500">
          Import S&P 500 companies and refresh financials to populate this table.
        </p>
      </div>
    );
  }

  return (
    <div className="max-h-[560px] overflow-auto rounded-2xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 text-left">Ticker</th>
            <th className="px-4 py-3 text-left">Company</th>
            <th className="px-4 py-3 text-left">Sector</th>
            <th className="px-4 py-3 text-right">Market Cap</th>
            <th className="px-4 py-3 text-right">Revenue TTM</th>
            <th className="px-4 py-3 text-right">P/E</th>
            <th className="px-4 py-3 text-right">ROE</th>
            <th className="px-4 py-3 text-right">Profit Margin</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row) => (
            <tr key={row.symbol} className="transition hover:bg-slate-50">
              <td className="px-4 py-3 font-bold text-slate-950">{row.symbol}</td>
              <td className="px-4 py-3">
                <div>
                  <p className="font-semibold text-slate-800">
                    {row.company_name ?? "—"}
                  </p>
                  <p className="text-xs text-slate-500">{row.industry ?? "—"}</p>
                </div>
              </td>
              <td className="px-4 py-3 text-slate-600">{row.sector ?? "—"}</td>
              <td className="px-4 py-3 text-right font-semibold">
                {formatCompactCurrency(row.market_cap)}
              </td>
              <td className="px-4 py-3 text-right">
                {formatCompactCurrency(row.revenue_ttm)}
              </td>
              <td className="px-4 py-3 text-right">{formatNumber(row.pe_ratio)}</td>
              <td className="px-4 py-3 text-right">
                {formatPercent(row.return_on_equity_ttm)}
              </td>
              <td className="px-4 py-3 text-right">
                {formatPercent(row.profit_margin)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
