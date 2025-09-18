// lib/stats/hub.ts
"use server";

import { METRICS, type MetricKey } from "@/lib/metrics";
import type { SeriesPoint } from "@/lib/format";
import { fetchSeries } from "@/lib/fetchers/series";
import type { StatBundle, StatSeries } from "./type";

// ---- Types inferred from METRICS.toSpec(iso3) ----
type SeriesSpecOf<K extends MetricKey = MetricKey> = ReturnType<
  (typeof METRICS)[K]["toSpec"]
>;

// ---- Simple in-memory cache (resets on server restart) ----
const mem = new Map<string, Promise<SeriesPoint[]>>();

const specKey = <K extends MetricKey>(k: K, iso3: string) =>
  JSON.stringify(METRICS[k].toSpec(iso3));

const getSeriesCached = <K extends MetricKey>(
  spec: SeriesSpecOf<K>
): Promise<SeriesPoint[]> => {
  const ck = JSON.stringify(spec);
  let p = mem.get(ck);
  if (!p) {
    p = fetchSeries(spec);
    mem.set(ck, p);
  }
  return p;
};

const lastPoint = (arr: ReadonlyArray<SeriesPoint>): SeriesPoint | null =>
  arr.length ? arr[arr.length - 1] : null;

// ------------------------------------------------------------
// Get series for many metrics for one country (ISO3)
// - Generic K ties output keys to input keys (no need to cast)
// ------------------------------------------------------------
export async function getStatsForGeo<K extends MetricKey>(
  metricKeys: readonly K[],
  iso3: string
): Promise<Record<K, StatSeries>> {
  const entries = await Promise.all(
    metricKeys.map(async (k) => {
      const spec = METRICS[k].toSpec(iso3) as SeriesSpecOf<K>;
      const series = await getSeriesCached(spec);
      const latest = lastPoint(series);

      const stat: StatSeries = {
        meta: {
          key: k,
          label: METRICS[k].label,
          unit: METRICS[k].unit,
          topic: METRICS[k].topic,
          source: METRICS[k].source,
        },
        series,
        latest: latest ? { year: latest.year, value: latest.value } : null,
      };

      return [k, stat] as const;
    })
  );

  // Object.fromEntries loses key literal info—rebuild strongly:
  const out = {} as Record<K, StatSeries>;
  for (const [k, v] of entries) out[k] = v;
  return out;
}

// ------------------------------------------------------------
// Convenience: just the latest values for cards
// ------------------------------------------------------------
export async function getLatestForGeo<K extends MetricKey>(
  metricKeys: readonly K[],
  iso3: string
): Promise<Record<K, number | null>> {
  const bundle = await getStatsForGeo(metricKeys, iso3);
  const out = {} as Record<K, number | null>;
  for (const k of metricKeys) {
    out[k] = bundle[k]?.latest?.value ?? null;
  }
  return out;
}

// ------------------------------------------------------------
// Convenience: one metric across many countries (for hotspot maps)
// ------------------------------------------------------------
export async function getLatestForMany(
  metricKey: MetricKey,
  iso3List: readonly string[]
): Promise<Array<{ iso3: string; latest: number | null }>> {
  const toSpec = (iso3: string) =>
    METRICS[metricKey].toSpec(iso3) as SeriesSpecOf;

  const rows = await Promise.all(
    iso3List.map(async (iso3) => {
      const series = await getSeriesCached(toSpec(iso3));
      const v = lastPoint(series)?.value ?? null;
      return {
        iso3,
        latest: Number.isFinite(v as number) ? (v as number) : null,
      };
    })
  );

  return rows;
}
