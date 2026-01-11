// app/api/faostat/overview/route.ts
import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

type OverviewPayload = {
  iso3: string;
  country: string;
  latest_year: number | null;

  production_qty: number | null;
  production_unit: string | null;

  import_qty: number | null;
  import_unit: string | null;

  export_qty: number | null;
  export_unit: string | null;

  kcal_per_capita_day: number | null;
  protein_g_per_capita_day: number | null;
  fat_g_per_capita_day: number | null;

  error?: string;
};

function asText(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const iso3 = asText(searchParams.get("iso3")).trim().toUpperCase();

  if (!iso3) {
    return NextResponse.json(
      { error: "Missing query param: iso3" },
      { status: 400 }
    );
  }

  // RPC: fetch_faostat_overview(p_iso3 text)
  const { data, error } = await supabase.rpc("fetch_faostat_overview", {
    p_iso3: iso3,
  });

  if (error) {
    return NextResponse.json(
      {
        error: `fetch_faostat_overview RPC failed: ${error.message}`,
      },
      { status: 500 }
    );
  }

  // Your RPC can return a JSON object directly OR a row with json column.
  const payload: OverviewPayload =
    (data as unknown as OverviewPayload) ??
    ({
      iso3,
      country: iso3,
      latest_year: null,
      production_qty: null,
      production_unit: null,
      import_qty: null,
      import_unit: null,
      export_qty: null,
      export_unit: null,
      kcal_per_capita_day: null,
      protein_g_per_capita_day: null,
      fat_g_per_capita_day: null,
      error: "No data returned from RPC.",
    } satisfies OverviewPayload);

  return NextResponse.json(payload);
}
