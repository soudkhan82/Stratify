// lib/format.ts

/** Normalized time-series point used across the app. */
export type SeriesPoint = {
  /** Calendar year (e.g., 1990, 2023). */
  year: number;
  /** Numeric value for that year. Use NaN/null upstream to filter before creating this. */
  value: number;
};

/** Utility: ensure points are sorted by year ascending and values are finite. */
export function normalizeSeries(points: ReadonlyArray<SeriesPoint>): SeriesPoint[] {
  return [...points]
    .filter((p) => Number.isFinite(p.year) && Number.isFinite(p.value))
    .sort((a, b) => a.year - b.year);
}

/** Utility: last point or null. */
export function lastPoint(points: ReadonlyArray<SeriesPoint>): SeriesPoint | null {
  return points.length ? points[points.length - 1] : null;
}
