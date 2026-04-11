"use client";

type KpiItem = {
  title: string;
  value: string;
  subtitle: string;
};

type Props = {
  items: KpiItem[];
};

export default function PolicyKpiGrid({ items }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.title}
          className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <p className="text-sm font-medium text-slate-500">{item.title}</p>
          <p className="mt-6 text-3xl font-semibold tracking-tight text-slate-900">
            {item.value}
          </p>
          <p className="mt-2 text-sm text-slate-500">{item.subtitle}</p>
        </div>
      ))}
    </div>
  );
}
