// lib/stats/types.ts
import type { SeriesPoint } from "@/lib/format";
import type { Metric, MetricKey } from "@/lib/metrics";

export type StatMeta = {
  key: MetricKey;
  label: string;
  unit: string;
  topic: Metric["topic"];
  source: Metric["source"];
};

export type StatSeries = {
  meta: StatMeta;
  series: SeriesPoint[];            // normalized {year,value}[]
  latest: { year: number; value: number } | null;
};

export type StatBundle = Record<MetricKey, StatSeries>;
