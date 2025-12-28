// app/api/map/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type MapPoint = {
  iso3: string;
  country: string;
  region: string | null;
  year: string | null;
  value: number;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function safeStr(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function safeNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * World Bank indicator endpoint for all countries:
 * [ meta, rows[] ]
 */
async function fetchIndicatorAllCountries(
  indicator: string
): Promise<MapPoint[]> {
  const url = `https://api.worldbank.org/v2/country/all/indicator/${encodeURIComponent(
    indicator
  )}?format=json&per_page=20000`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];

  const json: unknown = await res.json();
  if (!Array.isArray(json) || json.length < 2) return [];

  const rows = json[1];
  if (!Array.isArray(rows)) return [];

  const out: MapPoint[] = [];
  for (const r of rows) {
    if (!isRecord(r)) continue;

    const countryObj = isRecord(r.country) ? r.country : null;
    const iso2 = safeStr(r.countryiso3code) || safeStr(r.countryiso3Code); // sometimes casing changes
    const countryName = countryObj ? safeStr(countryObj.value) : null;

    const date = safeStr(r.date);
    const value = safeNum(r.value);

    // many rows are null; skip those so map colors correctly
    if (!iso2 || !countryName || value === null) continue;

    // region isn't in this endpoint; leave null (UI region filter can be backend later)
    out.push({
      iso3: iso2.toUpperCase(),
      country: countryName,
      region: null,
      year: date ?? null,
      value,
    });
  }

  // de-duplicate by iso3 taking first (latest) because endpoint is usually latest-first
  const seen = new Set<string>();
  const dedup: MapPoint[] = [];
  for (const p of out) {
    if (seen.has(p.iso3)) continue;
    seen.add(p.iso3);
    dedup.push(p);
  }

  return dedup;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const indicator = (searchParams.get("indicator") || "SP.POP.TOTL").trim();

    const points = await fetchIndicatorAllCountries(indicator);

    return NextResponse.json({ indicator, points }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
