import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("country_dim_clean")
      .select("country_code, country_name, region")
      .not("country_code", "is", null)
      .not("country_name", "is", null)
      .not("region", "is", null)
      .order("region", { ascending: true })
      .order("country_name", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: error.message, regions: [], countries: [] },
        { status: 500 }
      );
    }

    const rows = Array.isArray(data) ? data : [];

    const uniqueRegions = Array.from(
      new Set(rows.map((r) => r.region).filter(Boolean))
    );

    const countries = rows.map((r) => ({
      iso3: String(r.country_code).toUpperCase(),
      country: String(r.country_name),
      region: String(r.region),
    }));

    return NextResponse.json({
      regions: ["World", ...uniqueRegions],
      countries,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load filters",
        regions: [],
        countries: [],
      },
      { status: 500 }
    );
  }
}