// lib/fetchers/oecd.ts
import type { SeriesPoint } from "@/lib/format";

/**
 * OECD SDMX-JSON.
 * dataset: e.g., "MEI_CLI"
 * filterPath: SDMX key path, e.g., "PAK.IXOB.AMPLSA" (depends on dataset)
 * URL: https://stats.oecd.org/sdmx-json/data/{dataset}/{filterPath}/all?contentType=application/json
 *
 * Parser maps observations using the time dimension from structure.
 */
export async function fetchOECDSeries(dataset: string, filterPath: string): Promise<SeriesPoint[]> {
  const url = `https://stats.oecd.org/sdmx-json/data/${encodeURIComponent(dataset)}/${encodeURIComponent(
    filterPath
  )}/all?contentType=application/json`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`OECD ${dataset}/${filterPath} ${res.status}`);
  const json = await res.json();

  const ds = json?.dataSets?.[0];
  const timeDim = json?.structure?.dimensions?.observation?.find((d: any) => d.id === "TIME_PERIOD")
    ?? json?.structure?.dimensions?.observation?.[json?.structure?.dimensions?.observation?.length - 1];

  if (!ds || !timeDim) return [];

  // observations: { "0:0:...:tIndex": [value] }
  const pts: SeriesPoint[] = [];
  const timeValues: Array<{ id: string }> = timeDim.values ?? [];

  for (const [key, arr] of Object.entries(ds.observations ?? {})) {
    const parts = key.split(":");
    const tIdx = Number(parts[parts.length - 1]); // time is usually last dimension
    const yearStr = timeValues[tIdx]?.id ?? "";
    const y = parseInt(yearStr.slice(0, 4), 10);
    const v = Array.isArray(arr) ? Number(arr[0]) : NaN;
    if (Number.isFinite(y) && Number.isFinite(v)) pts.push({ year: y, value: v });
  }

  pts.sort((a, b) => a.year - b.year);
  return pts;
}
