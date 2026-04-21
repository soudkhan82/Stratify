type Props = {
  resultCount: number;
  summarySource?: string;
};

export default function PolicyPageHeader({
  resultCount,
  summarySource,
}: Props) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            Policy Intelligence
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            Analytical policy dashboard
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Explore policy programs, evidence coverage, linked indicators, and
            country-specific intelligence from the current API structure.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Visible programs
            </div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">
              {resultCount}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Source
            </div>
            <div className="mt-1 text-sm font-medium text-slate-800">
              {summarySource || "API"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
