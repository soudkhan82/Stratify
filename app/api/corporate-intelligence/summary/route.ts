import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Scope = "sp500" | "global" | "all";

type ProfileRow = {
  symbol: string | null;
  sector: string | null;
  industry: string | null;
  country: string | null;
  region: string | null;
  exchange: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  website: string | null;
  business_summary: string | null;
  hq_lat: number | null;
  hq_lng: number | null;
  source: string | null;
  source_universe: string | null;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeScope(value: string | null): Scope {
  const scope = clean(value).toLowerCase();

  if (scope === "global") return "global";
  if (scope === "all") return "all";

  return "sp500";
}

function applyScope(query: any, scope: Scope) {
  if (scope === "sp500") {
    return query.or("source_universe.eq.sp500,source.eq.github_sp500");
  }

  if (scope === "global") {
    return query.or(
      "source_universe.eq.global_large_caps,source_universe.eq.global_index,source.eq.wikidata_global,source.eq.global_large_caps",
    );
  }

  return query;
}

function uniqueCount(values: unknown[]) {
  return new Set(values.map(clean).filter(Boolean)).size;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const scope = normalizeScope(searchParams.get("scope"));

    const query = applyScope(
      supabase.from("ci_corporate_profiles").select(
        `
        symbol,
        sector,
        industry,
        country,
        region,
        exchange,
        address,
        city,
        state,
        website,
        business_summary,
        hq_lat,
        hq_lng,
        source,
        source_universe
      `,
      ),
      scope,
    );

    const { data, error } = await query;

    if (error) throw error;

    const rows = (data ?? []) as ProfileRow[];

    const enrichedProfiles = rows.filter((row) => {
      return (
        clean(row.address) ||
        clean(row.city) ||
        clean(row.state) ||
        clean(row.website) ||
        clean(row.business_summary) ||
        (row.hq_lat !== null && row.hq_lng !== null)
      );
    }).length;

    const exactHqLocations = rows.filter(
      (row) => row.hq_lat !== null && row.hq_lng !== null,
    ).length;

    return NextResponse.json({
      ok: true,
      scope,
      data: {
        total_companies: rows.length,
        sectors: uniqueCount(rows.map((row) => row.sector)),
        industries: uniqueCount(rows.map((row) => row.industry)),
        countries: uniqueCount(
          rows.map((row) =>
            scope === "sp500" ? row.country || "United States" : row.country,
          ),
        ),
        regions: uniqueCount(rows.map((row) => row.region)),
        exchanges: uniqueCount(rows.map((row) => row.exchange)),
        enriched_profiles: enrichedProfiles,
        exact_hq_locations: exactHqLocations,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to load corporate directory summary.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
        data: {
          total_companies: 0,
          sectors: 0,
          industries: 0,
          countries: 0,
          regions: 0,
          exchanges: 0,
          enriched_profiles: 0,
          exact_hq_locations: 0,
        },
      },
      { status: 500 },
    );
  }
}
