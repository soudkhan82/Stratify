import type { PolicyKpis } from "../_types/policy";

type Props = {
  kpis: PolicyKpis;
};

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
        {label}
      </div>
      <div className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
        {value}
      </div>
      <div className="mt-2 text-sm text-slate-600">{hint}</div>
    </div>
  );
}

export default function PolicyKpiGrid({ kpis }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Programs"
        value={kpis.programs}
        hint="Visible policy programs"
      />
      <KpiCard
        label="Evidence rows"
        value={kpis.evidence_rows}
        hint="Linked evidence base"
      />
      <KpiCard
        label="Indicator links"
        value={kpis.indicator_links}
        hint="Mapped indicators"
      />
      <KpiCard
        label="Country examples"
        value={kpis.country_examples}
        hint="Implementation examples"
      />
    </div>
  );
}
