// app/api/map/route.ts
import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const indicator = (searchParams.get("indicator") || "SP.POP.TOTL").trim();
    const region = (searchParams.get("region") || "").trim() || null;

    const { data, error } = await supabase.rpc("fetch_map_wdi", {
      p_indicator: indicator,
      p_region: region,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const points = (data ?? [])
      .map((r: any) => ({
        iso3: String(r.iso3 ?? "").toUpperCase(),
        country: String(r.country ?? ""),
        region: typeof r.region === "string" ? r.region : null,
        year: typeof r.year === "number" ? r.year : null,
        value: typeof r.value === "number" ? r.value : null,
      }))
      .filter((p: any) => p.iso3 && p.country && typeof p.value === "number");

    return NextResponse.json({ indicator, points }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
