// lib/stats/client.ts
import type { SeriesPoint } from "@/lib/format";
import { METRICS, type MetricKey, type MetricSource, type MetricTopic } from "@/lib/metrics";

export type StatMeta = {
  key: MetricKey;
  label: string;
  unit: string;
  topic: MetricTopic;
  source: MetricSource;
};

export type StatSeries = {
  meta: StatMeta;
  series: SeriesPoint[]; // normalized {year,value}[]
  latest: { year: number; value: number } | null;
};

export type StatBundle<K extends MetricKey = MetricKey> = Record<K, StatSeries>;

const API = "/api/stats";

function assertIso3(iso3: string): string {
  const ok = /^[A-Za-z]{3}$/.test(iso3);
  if (!ok) throw new Error("iso3 must be a 3-letter ISO3 code");
  return iso3.toUpperCase();
}

/** Get latest values for multiple metrics for one country (no series). */
export async function fetchLatestForGeo<K extends MetricKey>(
  iso3: string,
  metricKeys: readonly K[]
): Promise<StatBundle<K>> {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      iso3: assertIso3(iso3),
      metricKeys,
      includeSeries: false,
    }),
  });
  if (!res.ok) {
    const msg = await safeText(res);
    throw new Error(`POST /api/stats -> ${res.status} ${res.statusText}${msg ? `: ${msg}` : ""}`);
  }
  return (await res.json()) as StatBundle<K>;
}

/** Get series for a single metric for one country (includes latest + meta). */
export async function fetchSeriesForMetric(
  iso3: string,
  metric: MetricKey
): Promise<StatSeries> {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      iso3: assertIso3(iso3),
      metricKeys: [metric],
      includeSeries: true,
    }),
  });
  if (!res.ok) {
    const msg = await safeText(res);
    throw new Error(`POST /api/stats -> ${res.status} ${res.statusText}${msg ? `: ${msg}` : ""}`);
  }
  const bundle = (await res.json()) as StatBundle<MetricKey>;
  const out = bundle[metric];
  if (!out) throw new Error(`Metric ${metric} not found in response`);
  return out;
}

async function safeText(res: Response): Promise<string | null> {
  try {
    return await res.text();
  } catch {
    return null;
  }
}
