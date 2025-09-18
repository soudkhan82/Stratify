export type SeriesPoint = { year: number; value: number };
export const compact = (v: number) =>
  Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(v);
