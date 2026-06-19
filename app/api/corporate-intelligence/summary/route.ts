import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProfileRow = {
  symbol: string | null;
  sector: string | null;
  industry: string | null;
  country: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  website: string | null;
  business_summary: string | null;
  hq_lat: number | null;
  hq_lng: number | null;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function uniqueCount(values: unknown[]) {
  return new Set(values.map(clean).filter(Boolean)).size;
}

export async function GET() {
  try {
    const { data, error } = await supabase.from("ci_corporate_profiles").select(
      `
        symbol,
        sector,
        industry,
        country,
        address,
        city,
        state,
        website,
        business_summary,
        hq_lat,
        hq_lng
      `,
    );

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

    return NextResponse.json({
      ok: true,
      data: {
        total_companies: rows.length,
        sectors: uniqueCount(rows.map((row) => row.sector)),
        industries: uniqueCount(rows.map((row) => row.industry)),
        countries: uniqueCount(
          rows.map((row) => row.country || "United States"),
        ),
        enriched_profiles: enrichedProfiles,
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
          enriched_profiles: 0,
        },
      },
      { status: 500 },
    );
  }
}
