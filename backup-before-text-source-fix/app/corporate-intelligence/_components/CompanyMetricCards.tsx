import { Building2, DollarSign, Layers3, TrendingUp } from "lucide-react";
import type { CorporateSummary } from "../_lib/corporateTypes";
import { formatCompactCurrency, formatNumber } from "../_lib/corporateFormatters";

type Props = {
  summary: CorporateSummary | null;
  loading: boolean;
};

export default function CompanyMetricCards({ summary, loading }: Props) {
  const cards = [
    {
      label: "Companies",
      value: loading ? "..." : formatNumber(summary?.totalCompanies ?? 0, 0),
      icon: Building2,
    },
    {
      label: "Sectors",
      value: loading ? "..." : formatNumber(summary?.sectors ?? 0, 0),
      icon: Layers3,
    },
    {
      label: "Total Market Cap",
      value: loading ? "..." : formatCompactCurrency(summary?.totalMarketCap ?? 0),
      icon: DollarSign,
    },
    {
      label: "Average P/E",
      value: loading ? "..." : formatNumber(summary?.avgPeRatio ?? 0, 2),
      icon: TrendingUp,
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <div
            key={card.label}
            className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {card.label}
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{card.value}</p>
              </div>

              <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
