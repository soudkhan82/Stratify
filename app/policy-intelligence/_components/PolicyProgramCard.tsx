import type { PolicyProgram } from "../_types/policy";

type Props = {
  program: PolicyProgram;
  active?: boolean;
  onSelect: () => void;
};

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
      {children}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-slate-950">{value}</div>
    </div>
  );
}

export default function PolicyProgramCard({
  program,
  active,
  onSelect,
}: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "w-full rounded-3xl border bg-white p-4 text-left shadow-sm transition",
        active
          ? "border-slate-900 ring-1 ring-slate-900"
          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/60",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            {program.sector_key ? <Badge>{program.sector_key}</Badge> : null}
            {program.kind ? <Badge>{program.kind}</Badge> : null}
          </div>

          <h3 className="mt-3 text-lg font-semibold leading-6 tracking-tight text-slate-950">
            {program.program_name}
          </h3>

          <p className="mt-2 text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
            {program.program_key}
          </p>

          <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
            {program.program_description ||
              program.evidence_summary ||
              "No narrative description returned by the API yet."}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Success
          </div>
          <div className="mt-1 text-lg font-semibold text-slate-950">
            {program.success_score ?? "—"}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Metric label="Evidence" value={program.evidence_rows} />
        <Metric label="Indicators" value={program.indicator_links} />
        <Metric label="Examples" value={program.country_examples} />
      </div>
    </button>
  );
}
