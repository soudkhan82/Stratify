import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type CountryRow = {
  country_code: string | null;
  country_name: string | null;
  region: string | null;
};

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("country_dim_clean")
      .select("country_code, country_name, region")
      .not("country_code", "is", null)
      .not("country_name", "is", null)
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

    const rows = (data || []) as CountryRow[];

    const countries = rows.filter((r) => r.country_code && r.country_name);

    const regions = Array.from(
      new Set(
        countries.map((r) => r.region).filter((v): v is string => Boolean(v)),
      ),
    ).sort((a, b) => a.localeCompare(b));

    return NextResponse.json({
      ok: true,
      regions,
      countries,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown server error",
        regions: [],
        countries: [],
      },
      { status: 500 },
    );
  }
}
