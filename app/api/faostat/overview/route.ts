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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function normalizeRpc(data: unknown): {
  obj: Record<string, unknown> | null;
  arr: unknown[] | null;
} {
  if (Array.isArray(data)) {
    const first = data.find(isRecord) as Record<string, unknown> | undefined;
    return { obj: first ?? null, arr: data };
  }
  if (isRecord(data)) return { obj: data, arr: null };
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data) as unknown;
      if (Array.isArray(parsed)) {
        const first = parsed.find(isRecord) as
          | Record<string, unknown>
          | undefined;
        return { obj: first ?? null, arr: parsed };
      }
      if (isRecord(parsed)) return { obj: parsed, arr: null };
    } catch {}
  }
  return { obj: null, arr: null };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const iso3 = String(searchParams.get("iso3") || "")
      .trim()
      .toUpperCase();

    if (!iso3) {
      return NextResponse.json(
        { error: "Missing query param: iso3" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase.rpc("fetch_faostat_overview", {
      p_iso3: iso3,
    });

    if (error) {
      return NextResponse.json(
        {
          error: `fetch_faostat_overview RPC failed: ${error.message}`,
          details: error.details ?? null,
        },
        { status: 500 },
      );
    }

    const { obj } = normalizeRpc(data);

    const payload: OverviewPayload = {
      iso3,
      country: String(obj?.country ?? iso3),
      latest_year: (obj?.latest_year as number | null) ?? null,

      production_qty: (obj?.production_qty as number | null) ?? null,
      production_unit: (obj?.production_unit as string | null) ?? null,

      import_qty: (obj?.import_qty as number | null) ?? null,
      import_unit: (obj?.import_unit as string | null) ?? null,

      export_qty: (obj?.export_qty as number | null) ?? null,
      export_unit: (obj?.export_unit as string | null) ?? null,

      kcal_per_capita_day: (obj?.kcal_per_capita_day as number | null) ?? null,
      protein_g_per_capita_day:
        (obj?.protein_g_per_capita_day as number | null) ?? null,
      fat_g_per_capita_day:
        (obj?.fat_g_per_capita_day as number | null) ?? null,
    };

    // If everything is null, surface an explicit error for UI
    const allNull =
      payload.latest_year === null &&
      payload.production_qty === null &&
      payload.import_qty === null &&
      payload.export_qty === null &&
      payload.kcal_per_capita_day === null &&
      payload.protein_g_per_capita_day === null &&
      payload.fat_g_per_capita_day === null;

    if (allNull)
      payload.error = "No FAOSTAT overview data found for this ISO3.";

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 },
    );
  }
}
