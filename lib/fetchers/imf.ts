// lib/fetchers/imf.ts
import type { SeriesPoint } from "@/lib/format";

/**
 * IMF IFS CompactData SDMX-JSON.
 * Example:
 * database = "IFS"
 * indicator = "PCPIPCH" (CPI inflation, percent change)
 * country   = "PK" (ISO-2) or "PAK" (IMF supports ISO2/3 in many cases)
 *
 * URL pattern:
 * https://dataservices.imf.org/REST/SDMX_JSON.svc/CompactData/{db}/{freq}.{geo}.{indicator}
 * Common freq: A (annual), Q, M.
 */
export async function fetchIMFSeries(
  database: string, // e.g., "IFS"
  indicator: string, // e.g., "PCPIPCH"
  country: string, // e.g., "PAK"
  freq: "A" | "Q" | "M" = "A"
): Promise<SeriesPoint[]> {
  const key = `${freq}.${country}.${indicator}`;
  const url = `https://dataservices.imf.org/REST/SDMX_JSON.svc/CompactData/${encodeURIComponent(
    database
  )}/${encodeURIComponent(key)}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`IMF ${key} ${res.status}`);

  const json = await res.json();
  const series = json?.CompactData?.DataSet?.Series;
  const obs = Array.isArray(series?.Obs) ? series.Obs : series?.[0]?.Obs;
  if (!obs) return [];

  const pts: SeriesPoint[] = (
    obs as Array<{ "@TIME_PERIOD"?: string; "@OBS_VALUE"?: string }>
  )
    .map((o) => {
      const y = o?.["@TIME_PERIOD"]
        ? parseInt(o["@TIME_PERIOD"].slice(0, 4), 10)
        : NaN;
      const v = o?.["@OBS_VALUE"] ? Number(o["@OBS_VALUE"]) : NaN;
      return Number.isFinite(y) && Number.isFinite(v)
        ? { year: y, value: v }
        : null;
    })
    .filter((x): x is SeriesPoint => !!x)
    .sort((a, b) => a.year - b.year);

  return pts;
}
