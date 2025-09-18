// app/api/stats/latest/route.ts
import { NextResponse } from "next/server";
import { METRICS, type MetricKey } from "@/lib/metrics";

// If you want to ensure this route never caches at the edge
export const dynamic = "force-dynamic";

// ---- World Bank API typings ----
type WBPageInfo = {
  page: number;
  pages: number;
  per_page: string; // WB returns this as a string
  total: number;
  lastupdated: string;
};

type WBRow = {
  indicator: { id: string; value: string };
  country: { id: string; value: string };
  countryiso3code: string;
  date: string; // year like "2022"
  value: number | null;
  unit: string | null;
  obs_status: string | null;
  decimal: number | null;
};

type WBResponse = [WBPageInfo, WBRow[]];

// ---- Small helpers/guards ----
function isWBResponse(x: unknown): x is WBResponse {
  return (
    Array.isArray(x) &&
    x.length >= 2 &&
    typeof x[0] === "object" &&
    x[0] !== null &&
    Array.isArray(x[1])
  );
}

function isMetricKey(key: unknown): key is MetricKey {
  return typeof key === "string" && key in METRICS;
}

function validateISO3(s: unknown): s is string {
  return typeof s === "string" && /^[A-Za-z]{3}$/.test(s);
}

// ---- WB fetcher (latest non-null by year) ----
async function fetchWBLatest(
  iso3: string,
  indicator: string
): Promise<number | null> {
  const url = `https://api.worldbank.org/v2/country/${iso3}/indicator/${indicator}?format=json&per_page=100`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;

  const json: unknown = await res.json();
  if (!isWBResponse(json)) return null;

  const rows = [...json[1]]; // shallow copy to sort safely
  rows.sort((a, b) => Number(b?.date ?? 0) - Number(a?.date ?? 0));

  for (const row of rows) {
    if (row?.value !== null && row?.value !== undefined) {
      return Number(row.value);
    }
  }
  return null;
}

// ---- Route handler ----
export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();

    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const iso3Raw = (body as Record<string, unknown>).iso3;
    const metricKeysRaw = (body as Record<string, unknown>).metricKeys;

    if (!validateISO3(iso3Raw)) {
      return NextResponse.json(
        { error: "iso3 must be a 3-letter code" },
        { status: 400 }
      );
    }
    const iso3 = iso3Raw.toUpperCase();

    if (!Array.isArray(metricKeysRaw)) {
      return NextResponse.json(
        { error: "metricKeys must be an array" },
        { status: 400 }
      );
    }

    const metricKeys: MetricKey[] = metricKeysRaw.filter(isMetricKey);
    if (metricKeys.length === 0) {
      return NextResponse.json(
        { error: "No valid metric keys provided" },
        { status: 400 }
      );
    }

    // Initialize output strictly typed to only requested keys
    const out = Object.fromEntries(metricKeys.map((k) => [k, null])) as Record<
      MetricKey,
      number | null
    >;

    await Promise.all(
      metricKeys.map(async (key) => {
        const m = METRICS[key];
        if (m.source !== "WB") {
          out[key] = null;
          return;
        }
        out[key] = await fetchWBLatest(iso3, m.code);
      })
    );

    return NextResponse.json(out, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    // You can log err for server diagnostics if needed
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
