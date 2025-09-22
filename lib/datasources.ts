// lib/datasources.ts
import { fetchWorldBankSeries } from "@/lib/fetchers/worldbank";

export type SeriesPoint = { year: number; value: number };

// WB-only spec
export type SeriesSpec = { source: "WB"; code: string; geo: string };

export async function fetchSeries(spec: SeriesSpec): Promise<SeriesPoint[]> {
  switch (spec.source) {
    case "WB":
      return fetchWorldBankSeries(spec.code, spec.geo);
  }
}

export async function fetchLatest(spec: SeriesSpec): Promise<number | null> {
  const s = await fetchSeries(spec);
  return s.length ? s[s.length - 1].value : null;
}

export async function fetchLatestBulk(
  iso3s: readonly string[],
  makeSpec: (iso3: string) => SeriesSpec
): Promise<Record<string, number | null>> {
  const pairs = await Promise.all(
    iso3s.map(async (iso3) => {
      try {
        const v = await fetchLatest(makeSpec(iso3));
        return [iso3, v] as const;
      } catch {
        return [iso3, null] as const;
      }
    })
  );
  return Object.fromEntries(pairs);
}
