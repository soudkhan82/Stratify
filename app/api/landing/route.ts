// app/api/landing/route.ts
import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export const dynamic = "force-dynamic";

type WdiRow = {
  indicator_code: string;
  label: string;
  year: number | null;
  value: number | null;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const iso3Raw = (searchParams.get("iso3") || "").trim().toUpperCase();
    const iso3 = iso3Raw || null;

    const regionRaw = (searchParams.get("region") || "").trim();
    const regionParam = regionRaw || null;

    // If iso3 selected, ignore region filter
    const regionForRpc = iso3 ? null : regionParam;
    const scope: "world" | "country" = iso3 ? "country" : "world";

    let countryName: string | null = null;
    let countryRegion: string | null = null;

    if (iso3) {
      const { data: meta, error: metaErr } = await supabase
        .from("country_dim_clean")
        .select("country_name, region")
        .eq("country_code", iso3)
        .maybeSingle();

      if (metaErr) {
        return NextResponse.json({ error: metaErr.message }, { status: 500 });
      }

      countryName = meta?.country_name ?? null;
      countryRegion = meta?.region ?? null;
    }

    const { data, error } = await supabase.rpc("fetch_landing_wdi", {
      p_iso3: iso3,
      p_region: regionForRpc,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const wdi: WdiRow[] = (data ?? []).map((r: any) => ({
      indicator_code: String(r.indicator_code ?? ""),
      label: String(r.label ?? ""),
      year: typeof r.year === "number" ? r.year : null,
      value: typeof r.value === "number" ? r.value : null,
    }));

    return NextResponse.json(
      {
        scope,
        iso3,
        region: iso3 ? countryRegion : regionParam,
        countryName,
        wdi,
        suaYear: null,
        sua: [],
        prodYear: null,
        topCommodities: [],
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
