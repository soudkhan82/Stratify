// lib/fetchers/oecd.ts
import type { SeriesPoint } from "@/lib/format";

/**
 * Minimal SDMX-JSON typings for OECD responses.
 * We only model what we actually read.
 */
type SdmxValue = { id: string; name?: string };
type SdmxDimension = { id: string; name?: string; values: SdmxValue[] };
type SdmxStructure = { dimensions: { observation: SdmxDimension[] } };
type SdmxDataSet = { observations?: Record<string, Array<number | null>> };
type OecdSdmxJson = {
  dataSets?: SdmxDataSet[];
  structure?: SdmxStructure;
};

/** Type guard for the minimal shape we use */
function isOecdSdmxJson(x: unknown): x is OecdSdmxJson {
  if (typeof x !== "object" || x === null) return false;
  const obj = x as Record<string, unknown>;
  const dataSets = obj.dataSets;
  const structure = obj.structure;
  const okDataSets = Array.isArray(dataSets);
  const okStructure =
    typeof structure === "object" &&
    structure !== null &&
    typeof (structure as any).dimensions === "object" &&
    (structure as any).dimensions !== null &&
    Array.isArray((structure as any).dimensions.observation);
  return okDataSets && okStructure;
}

function pickTimeDimension(structure: SdmxStructure): SdmxDimension | null {
  // Prefer TIME_PERIOD; otherwise fall back to last observation dimension
  const dims = structure.dimensions.observation;
  const byId = dims.find(
    (d) => d.id === "TIME_PERIOD" || d.id === "TIME" || d.id === "Time"
  );
  return byId ?? dims[dims.length - 1] ?? null;
}

/** Extract a 4-digit year from common SDMX time ids: "2024", "2024-Q1", "2024-01", etc. */
function parseYearFromTimeId(id: string): number | null {
  const m = /^(\d{4})/.exec(id);
  if (!m) return null;
  const year = Number(m[1]);
  return Number.isFinite(year) ? year : null;
}

/**
 * OECD SDMX-JSON.
 * dataset: e.g., "MEI_CLI"
 * filterPath: SDMX key path, e.g., "PAK.IXOB.AMPLSA" (depends on dataset)
 * URL: https://stats.oecd.org/sdmx-json/data/{dataset}/{filterPath}/all?contentType=application/json
 */
export async function fetchOECDSeries(
  dataset: string,
  filterPath: string
): Promise<SeriesPoint[]> {
  const url = `https://stats.oecd.org/sdmx-json/data/${encodeURIComponent(
    dataset
  )}/${encodeURIComponent(filterPath)}/all?contentType=application/json`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`OECD ${dataset}/${filterPath} ${res.status}`);

  const jsonUnknown: unknown = await res.json();
  if (!isOecdSdmxJson(jsonUnknown)) {
    // Graceful fallback: return empty rather than throwing a vague error
    return [];
  }

  const ds = jsonUnknown.dataSets?.[0];
  const timeDim = jsonUnknown.structure
    ? pickTimeDimension(jsonUnknown.structure)
    : null;

  if (!ds || !timeDim) return [];

  const timeValues: ReadonlyArray<SdmxValue> = Array.isArray(timeDim.values)
    ? timeDim.values
    : [];
  const obs = ds.observations ?? {};

  const points: SeriesPoint[] = [];

  for (const [key, arr] of Object.entries(obs)) {
    // Keys look like "0:1:...:tIndex" (time is usually last dimension)
    const parts = key.split(":");
    const tIdx = Number(parts[parts.length - 1]);
    const timeId = timeValues[tIdx]?.id ?? "";
    const year = parseYearFromTimeId(timeId);

    const valueRaw = Array.isArray(arr) ? arr[0] : null; // [value, flag?, ...]
    const value = typeof valueRaw === "number" ? valueRaw : null;

    if (year !== null && value !== null && Number.isFinite(value)) {
      points.push({ year, value });
    }
  }

  points.sort((a, b) => a.year - b.year);
  return points;
}
