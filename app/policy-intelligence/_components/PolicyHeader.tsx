"use client";

type Props = {
  eyebrow: string;
  title: string;
  description: string;
};

export default function PolicyHeader({ eyebrow, title, description }: Props) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div className="max-w-3xl">
        <p className="text-sm text-slate-500">{eyebrow}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-600">{description}</p>
      </div>

      <div className="flex gap-3">
        <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
          Refresh
        </button>
        <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800">
          Export CSV
        </button>
      </div>
    </div>
  );
}
