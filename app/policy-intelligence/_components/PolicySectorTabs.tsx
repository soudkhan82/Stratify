"use client";

type Sector = {
  key: string;
  label: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  sectors: Sector[];
};

export default function PolicySectorTabs({ value, onChange, sectors }: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        {sectors.map((sector) => {
          const active = value === sector.key;

          return (
            <button
              key={sector.key}
              type="button"
              onClick={() => onChange(sector.key)}
              className={[
                "rounded-2xl px-4 py-3 text-sm font-semibold transition",
                active
                  ? "bg-[#16a34a] text-white shadow-sm"
                  : "bg-white text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              {sector.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
