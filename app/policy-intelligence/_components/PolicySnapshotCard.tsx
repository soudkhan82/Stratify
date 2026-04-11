"use client";

type Props = {
  sector: string;
  focus: string;
  country: string;
  status: string;
};

export default function PolicySnapshotCard({
  sector,
  focus,
  country,
  status,
}: Props) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-slate-900">Snapshot</h3>
        <p className="mt-1 text-sm text-slate-500">
          Sector summary and evidence posture for the current workspace.
        </p>
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
            Active sector
          </p>
          <p className="mt-2 text-base font-semibold text-[#0b8a4b]">
            {sector}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
            Country focus
          </p>
          <p className="mt-2 text-base font-semibold text-slate-900">
            {country}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
            Focus
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{focus}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
            Status
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{status}</p>
        </div>
      </div>
    </div>
  );
}
