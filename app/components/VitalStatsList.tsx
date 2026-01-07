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

type Props = {
  sections: StatSection[];
  region?: string | null;
  subtitle?: string;
};

export default function VitalStatsList({ sections, region, subtitle }: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <div className="text-xs tracking-widest text-slate-400">SNAPSHOT</div>
        {subtitle ? (
          <div className="mt-1 text-sm text-slate-700">{subtitle}</div>
        ) : null}
        <div className="mt-2 text-xs text-slate-500">
          Scope: <span className="font-semibold">{region ?? "World"}</span>
        </div>
      </div>

      {sections.map((sec) => (
        <div key={sec.title} className="rounded-xl border bg-white">
          <div className="px-4 py-3 border-b">
            <div className="text-xs tracking-widest text-slate-400">
              {sec.title}
            </div>
          </div>

          <div className="divide-y">
            {sec.rows.map((r, idx) => (
              <div key={`${sec.title}-${idx}`} className="px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-medium text-slate-900">
                    {r.label}
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-slate-900">
                    {r.value}
                  </div>
                </div>
                {r.meta ? (
                  <div className="mt-1 text-xs text-slate-500">{r.meta}</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
