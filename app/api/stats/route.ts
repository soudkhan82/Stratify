// app/api/stats/route.ts
import { NextResponse } from "next/server";
import { METRICS, type MetricKey } from "@/lib/metrics";

import type { SeriesPoint } from "@/lib/format";
import { fetchSeries } from "@/lib/datasources";

export const dynamic = "force-dynamic"; // ensure it's not pruned at build

// ---------- Types returned to the client ----------
type StatMeta = {
  key: MetricKey;
  label: string;
  unit: string;
  topic: (typeof METRICS)[MetricKey]["topic"];
  source: (typeof METRICS)[MetricKey]["source"];
};

export type StatSeries = {
  meta: StatMeta;
  series: SeriesPoint[]; // normalized {year,value}[]
  latest: { year: number; value: number } | null;
};

export type StatBundle<K extends MetricKey = MetricKey> = Record<K, StatSeries>;

// ---------- Simple in-memory promise cache ----------
type CacheKey = string;
const getGlobalCache = () => {
  const g = globalThis as any;
  g.__statsCache ??= new Map<CacheKey, Promise<SeriesPoint[]>>();
  return g.__statsCache as Map<CacheKey, Promise<SeriesPoint[]>>;
};
const cache = getGlobalCache();

const lastPoint = (arr: ReadonlyArray<SeriesPoint>) =>
  arr.length ? arr[arr.length - 1] : null;

const isMetricKey = (x: unknown): x is MetricKey =>
  typeof x === "string" && x in METRICS;

const validateISO3 = (s: unknown): s is string =>
  typeof s === "string" && /^[A-Za-z]{3}$/.test(s);

// ---------- POST /api/stats ----------
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const iso3Raw = body?.iso3;
    const metricKeysRaw = body?.metricKeys;
    const includeSeries: boolean = Boolean(body?.includeSeries); // default false

    if (!validateISO3(iso3Raw)) {
      return NextResponse.json({ error: "iso3 must be ISO3" }, { status: 400 });
    }
    const iso3 = iso3Raw.toUpperCase();

    if (!Array.isArray(metricKeysRaw)) {
      return NextResponse.json(
        { error: "metricKeys must be an array" },
        { status: 400 }
      );
    }

    const metricKeys = (metricKeysRaw as unknown[]).filter(
      isMetricKey
    ) as MetricKey[];
    if (metricKeys.length === 0) {
      return NextResponse.json(
        { error: "No valid metric keys provided" },
        { status: 400 }
      );
    }

    const entries = await Promise.all(
      metricKeys.map(async (k) => {
        const spec = METRICS[k].toSpec(iso3);
        const ckey = JSON.stringify(spec);

        let p = cache.get(ckey);
        if (!p) {
          p = fetchSeries(spec);
          cache.set(ckey, p);
        }
        const series = await p;

        const latest = lastPoint(series);
        const meta: StatMeta = {
          key: k,
          label: METRICS[k].label,
          unit: METRICS[k].unit,
          topic: METRICS[k].topic,
          source: METRICS[k].source,
        };

        const stat: StatSeries = {
          meta,
          series: includeSeries ? series : [],
          latest: latest ? { year: latest.year, value: latest.value } : null,
        };

        return [k, stat] as const;
      })
    );

    const bundle = Object.fromEntries(entries) as StatBundle;
    return NextResponse.json(bundle, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
