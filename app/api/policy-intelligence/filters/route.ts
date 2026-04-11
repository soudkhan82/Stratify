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
          ok: false,
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
          ok: false,
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

    const countries = rows
      .map((row) => ({
        iso3: String(row.country_code ?? "")
          .toUpperCase()
          .trim(),
        country: String(row.country_name ?? "").trim(),
        region: String(row.region ?? "").trim(),
      }))
      .filter(
        (row) =>
          row.iso3.length > 0 &&
          row.country.length > 0 &&
          row.region.length > 0,
      );

    const uniqueRegions = Array.from(
      new Set(countries.map((row) => row.region)),
    ).sort((a, b) => a.localeCompare(b));

    const countsByRegion = uniqueRegions.map((region) => ({
      region,
      count: countries.filter((c) => c.region === region).length,
    }));

    return NextResponse.json({
      ok: true,
      regions: ["World", ...uniqueRegions],
      countries,
      debug: {
        totalRows: rows.length,
        validCountries: countries.length,
        countsByRegion,
        sample: countries.slice(0, 10),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown server error",
        regions: [],
        countries: [],
      },
      { status: 500 },
    );
  }
}
