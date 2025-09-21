// lib/fetchers/worldbank.ts
import type { SeriesPoint } from "@/lib/datasources";

type WbValue = {
  value: number | null;
  date: string; // year as string
};

type WbResponse =
  | [/* meta */ unknown, /* data */ WbValue[]]
  | [/* meta */ unknown, /* data */ []];

export async function fetchWorldBankSeries(
  indicatorCode: string,
  iso3: string
): Promise<SeriesPoint[]> {
  const url = `https://api.worldbank.org/v2/country/${encodeURIComponent(
    iso3
  )}/indicator/${encodeURIComponent(indicatorCode)}?format=json&per_page=20000`;

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return [];

  const json = (await res.json()) as WbResponse;
  const data = Array.isArray(json) && Array.isArray(json[1]) ? json[1] : [];

  // Filter + normalize + ascending by year
  const points: SeriesPoint[] = data
    .map((d): SeriesPoint | null => {
      const y = Number(d.date);
      const v = typeof d.value === "number" ? d.value : null;
      return Number.isFinite(y) && v !== null ? { year: y, value: v } : null;
    })
    .filter((p): p is SeriesPoint => p !== null)
    .sort((a, b) => a.year - b.year);

  return points;
}
