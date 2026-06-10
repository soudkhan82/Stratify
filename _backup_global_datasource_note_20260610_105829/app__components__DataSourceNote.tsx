import type { ReactNode } from "react";

export const DATA_SOURCE_NOTES = {
  landing:
    "Data source: Global indicators are compiled from World Bank Open Data, FAOSTAT, IMF/WEO, UN datasets, and curated public sources.",
  debt:
    "Data source: Public debt and macro-fiscal indicators are sourced from IMF/WEO, World Bank, and related international financial datasets.",
  energy:
    "Data source: Energy indicators are sourced from World Bank Open Data, IEA-linked public datasets, and national/international statistical sources.",
  faostat:
    "Data source: Agriculture, food security, land-use, livestock, production, and supply utilization indicators are sourced primarily from FAOSTAT.",
  fiscal:
    "Data source: Fiscal and government finance indicators are compiled from IMF/WEO, World Bank, and publicly available macroeconomic datasets.",
  corporate:
    "Data source: Corporate directory data is based on S&P 500 public company listings and curated public corporate profile datasets.",
} as const;

type DataSourceNoteProps = {
  children: ReactNode;
  className?: string;
};

export default function DataSourceNote({
  children,
  className = "",
}: DataSourceNoteProps) {
  return (
    <div
      className={[
        "mt-2 flex max-w-4xl items-start gap-2 rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 text-xs font-medium leading-5 text-slate-500 shadow-sm backdrop-blur",
        className,
      ].join(" ")}
    >
      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
      <span>{children}</span>
    </div>
  );
}
