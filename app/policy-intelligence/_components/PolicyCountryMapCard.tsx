"use client";

type Props = {
  title: string;
  country: string;
  iso3: string;
  sector: string;
};

export default function PolicyCountryMapCard({
  title,
  country,
  iso3,
  sector,
}: Props) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">
          Highlighted country for the active workspace
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
            Country
          </p>
          <p className="mt-2 text-base font-semibold text-slate-900">
            {country}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
            ISO3
          </p>
          <p className="mt-2 text-base font-semibold text-[#0b8a4b]">{iso3}</p>
        </div>
      </div>

      <div className="flex h-[320px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50">
        <div className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#16a34a] text-2xl font-bold text-white shadow-sm">
            {iso3}
          </div>
          <p className="mt-4 text-base font-semibold text-slate-900">
            {country}
          </p>
          <p className="mt-1 text-sm text-slate-500">Active sector: {sector}</p>
        </div>
      </div>
    </div>
  );
}
