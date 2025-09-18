// app/api/stats/latest/route.ts
import { NextResponse } from "next/server";
import { METRICS, type MetricKey } from "@/lib/metrics";

async function fetchWBLatest(iso3: string, indicator: string): Promise<number | null> {
  const url = `https://api.worldbank.org/v2/country/${iso3}/indicator/${indicator}?format=json&per_page=100`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;

  const json = await res.json();
  const rows = Array.isArray(json) && Array.isArray(json[1]) ? json[1] : [];
  // Ensure we choose the latest non-null by year, not just “first”
  rows.sort((a: any, b: any) => Number(b?.date ?? 0) - Number(a?.date ?? 0));
  for (const row of rows) {
    const v = row?.value;
    if (v !== null && v !== undefined && v !== "") return Number(v);
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const { iso3, metricKeys } = (await req.json()) as { iso3: string; metricKeys: MetricKey[] };
    const out: Record<MetricKey, number | null> = {} as Record<MetricKey, number | null>;

    await Promise.all(
      metricKeys.map(async (key) => {
        const m = METRICS[key];
        if (m.source !== "WB") { out[key] = null; return; }
        out[key] = await fetchWBLatest(iso3, m.code);
      })
    );

    return NextResponse.json(out);
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
