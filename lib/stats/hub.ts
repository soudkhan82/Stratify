// lib/stats/hub.ts
"use server";

import { METRICS, type MetricKey } from "@/lib/metrics";

import type { SeriesPoint } from "@/lib/format";
import { fetchSeries } from "@/lib/fetchers/series";
import { StatBundle, StatSeries } from "./type";

// simple in-memory cache (resets on server restart)
const mem = new Map<string, Promise<SeriesPoint[]>>();
const keyOf = (metricKey: MetricKey, iso3: string) =>
  JSON.stringify({ spec: METRICS[metricKey].toSpec(iso3) });

// Get series for many metrics for one country (ISO3)
export async function getStatsForGeo(
  metricKeys: MetricKey[],
  iso3: string
): Promise<StatBundle> {
  const entries = await Promise.all(
    metricKeys.map(async (k) => {
      const spec = METRICS[k].toSpec(iso3);
      const ck = JSON.stringify(spec);
      if (!mem.has(ck)) mem.set(ck, fetchSeries(spec));
      const series = await mem.get(ck)!;
      const latest = series.length ? series[series.length - 1] : null;

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

  return Object.fromEntries(entries) as StatBundle;
}

// Convenience: just the latest values for cards
export async function getLatestForGeo(
  metricKeys: MetricKey[],
  iso3: string
): Promise<Record<MetricKey, number | null>> {
  const bundle = await getStatsForGeo(metricKeys, iso3);
  const out: Record<MetricKey, number | null> = {} as any;
  for (const k of metricKeys) out[k] = bundle[k]?.latest?.value ?? null;
  return out;
}

// Convenience: one metric across many countries (for hotspot maps)
export async function getLatestForMany(
  metricKey: MetricKey,
  iso3List: string[]
): Promise<Array<{ iso3: string; latest: number | null }>> {
  const specOf = (iso3: string) => METRICS[metricKey].toSpec(iso3);

  const rows = await Promise.all(
    iso3List.map(async (iso3) => {
      const ck = JSON.stringify(specOf(iso3));
      if (!mem.has(ck)) mem.set(ck, fetchSeries(specOf(iso3)));
      const s = await mem.get(ck)!;
      const v = s.length ? s[s.length - 1].value : null;
      return {
        iso3,
        latest: Number.isFinite(v as number) ? (v as number) : null,
      };
    })
  );

  return rows;
}
