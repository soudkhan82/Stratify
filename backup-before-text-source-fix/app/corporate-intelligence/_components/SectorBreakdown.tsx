import type { CompanyFinancialSnapshot } from "../_lib/corporateTypes";
import { formatCompactCurrency } from "../_lib/corporateFormatters";

type Props = {
  rows: CompanyFinancialSnapshot[];
  loading: boolean;
};

export default function SectorBreakdown({ rows, loading }: Props) {
  const sectors = Object.values(
    rows.reduce<Record<string, { sector: string; count: number; marketCap: number }>>(
      (acc, row) => {
        const sector = row.sector || "Unknown";

        if (!acc[sector]) {
          acc[sector] = {
            sector,
            count: 0,
            marketCap: 0,
          };
        }

        acc[sector].count += 1;
        acc[sector].marketCap += row.market_cap ?? 0;

        return acc;
      },
      {}
    )
  ).sort((a, b) => b.marketCap - a.marketCap);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-lg font-bold text-slate-950">Sector Breakdown</h2>
        <p className="text-xs text-slate-500">Company count and market cap by sector</p>
      </div>

      {loading ? (
        <div className="flex h-80 items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-500">
          Loading sectors...
        </div>
      ) : sectors.length ? (
        <div className="max-h-80 space-y-3 overflow-auto pr-1">
          {sectors.map((item) => (
            <div key={item.sector} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-800">{item.sector}</p>
                  <p className="text-xs text-slate-500">{item.count} companies</p>
                </div>
                <p className="text-sm font-bold text-slate-950">
                  {formatCompactCurrency(item.marketCap)}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-80 items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-500">
          No sector data available.
        </div>
      )}
    </div>
  );
}
