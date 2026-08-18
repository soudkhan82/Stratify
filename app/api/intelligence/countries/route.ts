import { NextResponse } from "next/server";

import { GEO_REGION_OVERRIDES } from "@/app/lib/intelligence/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_SECONDS = 24 * 60 * 60;

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function canonicalRegion(value: unknown) {
  const region = clean(value);
  const lower = region.toLowerCase();

  if (lower.includes("sub-saharan africa")) return "Sub-Saharan Africa";
  if (lower.includes("europe") && lower.includes("central asia")) {
    return "Europe & Central Asia";
  }
  if (lower.includes("middle east") && lower.includes("north africa")) {
    return "Middle East & North Africa";
  }
  if (lower.includes("south asia")) return "South Asia";
  if (lower.includes("east asia") && lower.includes("pacific")) {
    return "East Asia & Pacific";
  }
  if (lower.includes("latin america") && lower.includes("caribbean")) {
    return "Latin America & Caribbean";
  }
  if (lower.includes("north america")) return "North America";

  return region || null;
}

export async function GET() {
  try {
    const response = await fetch(
      "https://api.worldbank.org/v2/country?format=json&per_page=400",
      {
        next: { revalidate: CACHE_SECONDS },
        headers: {
          Accept: "application/json",
          "User-Agent": "Stratify Country Intelligence https://worldstats360.com",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`World Bank country metadata failed: ${response.status}`);
    }

    const json = await response.json();
    const sourceRows = Array.isArray(json?.[1]) ? json[1] : [];

    const countries = sourceRows
      .map((row: any) => {
        const iso3 = clean(row?.id).toUpperCase();
        const name = clean(row?.name);
        const regionId = clean(row?.region?.id).toUpperCase();
        const region = GEO_REGION_OVERRIDES[iso3] ?? canonicalRegion(row?.region?.value);
        const incomeLevel = clean(row?.incomeLevel?.value) || null;

        if (iso3.length !== 3 || !name || regionId === "NA" || !region) {
          return null;
        }

        return {
          iso3,
          name,
          region,
          incomeLevel,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.name.localeCompare(b.name));

    return NextResponse.json(
      {
        ok: true,
        count: countries.length,
        countries,
      },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=604800`,
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load country list.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
        count: 0,
        countries: [],
      },
      { status: 500 },
    );
  }
}
