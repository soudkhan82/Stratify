// lib/fetchers/oecd.ts
import type { SeriesPoint } from "@/lib/format";

/** ---- Minimal SDMX-JSON typings we actually read ---- */
type SdmxValue = { id: string; name?: string };
type SdmxDimension = { id: string; name?: string; values: SdmxValue[] };
type SdmxStructure = { dimensions: { observation: SdmxDimension[] } };
type SdmxDataSet = { observations?: Record<string, Array<number | null>> };
type OecdSdmxJson = {
  dataSets?: SdmxDataSet[];
  structure?: SdmxStructure;
};

/** ---- Type guards (no `any`) ---- */
function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function isSdmxValue(x: unknown): x is SdmxValue {
  return isRecord(x) && typeof x.id === "string";
}

function isSdmxDimension(x: unknown): x is SdmxDimension {
  if (!isRecord(x)) return false;
  if (typeof x.id !== "string") return false;
  if (!Array.isArray(x.values)) return false;
  return x.values.every(isSdmxValue);
}

function isSdmxStructure(x: unknown): x is SdmxStructure {
  if (!isRecord(x)) return false;
  const dims = isRecord(x.dimensions) ? x.dimensions : null;
  const obs =
    dims && Array.isArray((dims as { observation?: unknown }).observation)
      ? (dims as { observation: unknown[] }).observation
      : null;
  return Array.isArray(obs) && obs.every(isSdmxDimension);
}

function isObsRecord(x: unknown): x is Record<string, Array<number | null>> {
  if (!isRecord(x)) return false;
  return Object.values(x).every(
    (v) =>
      Array.isArray(v) && v.every((n) => n === null || typeof n === "number")
  );
}

function isSdmxDataSet(x: unknown): x is SdmxDataSet {
  if (!isRecord(x)) return false;
  if (x.observations === undefined) return true;
  return isObsRecord(x.observations);
}

function isOecdSdmxJson(x: unknown): x is OecdSdmxJson {
  if (!isRecord(x)) return false;
  const okDataSets =
    x.dataSets === undefined ||
    (Array.isArray(x.dataSets) && x.dataSets.every(isSdmxDataSet));
  const okStructure = x.structure === undefined || isSdmxStructure(x.structure);
  return okDataSets && okStructure;
}

/** ---- Helpers ---- */
function pickTimeDimension(structure: SdmxStructure): SdmxDimension | null {
  const dims = structure.dimensions.observation;
  const byId = dims.find(
    (d) => d.id === "TIME_PERIOD" || d.id === "TIME" || d.id === "Time"
  );
  return byId ?? dims[dims.length - 1] ?? null;
}

/** Extract a 4-digit year from time ids like "2024", "2024-Q1", "2024-01", etc. */
function parseYearFromTimeId(id: string): number | null {
  const m = /^(\d{4})/.exec(id);
  if (!m) return null;
  const year = Number(m[1]);
  return Number.isFinite(year) ? year : null;
}

/** ---- Fetcher ----
 * OECD SDMX-JSON.
 * dataset: e.g., "MEI_CLI"
 * filterPath: SDMX key path, e.g., "PAK.IXOB.AMPLSA"
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
  if (!isOecdSdmxJson(jsonUnknown)) return [];

  const ds = jsonUnknown.dataSets?.[0];
  const timeDim = jsonUnknown.structure
    ? pickTimeDimension(jsonUnknown.structure)
    : null;

  if (!ds || !timeDim) return [];

  const timeValues: ReadonlyArray<SdmxValue> = timeDim.values ?? [];
  const obs: Record<string, Array<number | null>> = ds.observations ?? {};

  const points: SeriesPoint[] = [];

  for (const [key, arr] of Object.entries(obs)) {
    // Observation key like "0:1:...:tIndex" (time usually last)
    const parts = key.split(":");
    const tIdx = Number(parts[parts.length - 1]);
    const timeId = timeValues[tIdx]?.id ?? "";
    const year = parseYearFromTimeId(timeId);

    const valueRaw = Array.isArray(arr) ? arr[0] : null; // [value, ...]
    const value = typeof valueRaw === "number" ? valueRaw : null;

    if (year !== null && value !== null && Number.isFinite(value)) {
      points.push({ year, value });
    }
  }

  points.sort((a, b) => a.year - b.year);
  return points;
}
