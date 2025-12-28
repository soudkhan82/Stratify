// app/components/VitalStatsList.tsx
"use client";

export type StatRow = {
  label: string;
  value: string;
  meta?: string;
  indicatorCode?: string | null;
};

export type StatSection = {
  title: string;
  rows: StatRow[];
};

export default function VitalStatsList({
  sections,
  subtitle,
}: {
  sections: StatSection[];
  region?: string | null;
  subtitle?: string;
}) {
  return (
    <div className="space-y-4">
      {subtitle ? (
        <div className="text-sm text-slate-500">{subtitle}</div>
      ) : null}

      {sections.map((sec) => (
        <div key={sec.title} className="rounded-xl border bg-white">
          <div className="px-4 py-3 border-b">
            <div className="text-xs tracking-widest text-slate-500">
              {sec.title}
            </div>
          </div>
          <div className="p-4 space-y-3">
            {sec.rows.map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">
                    {r.label}
                  </div>
                  {r.meta ? (
                    <div className="text-xs text-slate-500">{r.meta}</div>
                  ) : null}
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {r.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
