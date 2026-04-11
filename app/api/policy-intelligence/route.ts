import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CountryRow = {
  country_code: string | null;
  country_name: string | null;
  region: string | null;
};

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        {
          error:
            "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
          regions: [],
          countries: [],
        },
        { status: 500 },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
        {
          error: error.message,
          regions: [],
          countries: [],
        },
        { status: 500 },
      );
    }

    const rows: CountryRow[] = Array.isArray(data)
      ? (data as CountryRow[])
      : [];

    const uniqueRegions = Array.from(
      new Set(
        rows
          .map((r) => (r.region ? String(r.region).trim() : null))
          .filter((v): v is string => Boolean(v)),
      ),
    );

    const countries = rows
      .filter(
        (r) =>
          r.country_code !== null &&
          r.country_name !== null &&
          r.region !== null,
      )
      .map((r) => ({
        iso3: String(r.country_code).trim().toUpperCase(),
        country: String(r.country_name).trim(),
        region: String(r.region).trim(),
      }));

    return NextResponse.json({
      regions: ["World", ...uniqueRegions],
      countries,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load filters",
        regions: [],
        countries: [],
      },
      { status: 500 },
    );
  }
}
