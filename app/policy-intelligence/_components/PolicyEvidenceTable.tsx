type Props = {
  evidenceSummary: string | null;
  risks: string | null;
};

export default function PolicyEvidenceTable({ evidenceSummary, risks }: Props) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
        Evidence and risk
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3">
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">
            Evidence summary
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            {evidenceSummary || "No evidence summary returned by the API yet."}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Risks</div>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            {risks || "No risk narrative returned by the API yet."}
          </p>
        </div>
      </div>
    </div>
  );
}
