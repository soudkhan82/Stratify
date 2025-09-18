// lib/fetchers/eia.ts
import type { SeriesPoint } from "@/lib/format";

/**
 * EIA series fetcher. Requires NEXT_PUBLIC_EIA_API_KEY.
 * seriesId examples: "INTL.4708-GB.A" (check EIA browser)
 * API returns [[period,value]] where period like "2020" or "202001".
 */
export async function fetchEIASeries(seriesId: string): Promise<SeriesPoint[]> {
  const key = process.env.NEXT_PUBLIC_EIA_API_KEY;
  if (!key) throw new Error("Missing NEXT_PUBLIC_EIA_API_KEY");

  const url = `https://api.eia.gov/series/?api_key=${encodeURIComponent(key)}&series_id=${encodeURIComponent(seriesId)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`EIA ${seriesId} ${res.status}`);

  const json = await res.json();
  const s = json?.series?.[0];
  if (!s?.data) return [];

  const pts: SeriesPoint[] = (s.data as Array<[string | number, number]>)
    .map(([period, val]) => {
      const p = String(period);
      const year = parseInt(p.slice(0, 4), 10);
      const value = Number(val);
      return Number.isFinite(year) && Number.isFinite(value) ? { year, value } : null;
    })
    .filter((x): x is SeriesPoint => !!x)
    .sort((a, b) => a.year - b.year);

  return pts;
}
