import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const iso3 = String(searchParams.get("iso3") || "").toUpperCase();
    const indicator = String(searchParams.get("indicator") || "");
    const vintage = String(searchParams.get("vintage") || "");

    if (!iso3 || !indicator || !vintage) {
      return NextResponse.json({ ok: false, error: "Missing params" });
    }

    const { data, error } = await supabase.rpc("weo_country_series", {
      p_iso3: iso3,
      p_indicator: indicator,
      p_vintage: vintage,
    });

    if (error) return NextResponse.json({ ok: false, error: error.message });

    return NextResponse.json({
      ok: true,
      iso3,
      indicator,
      vintage,
      series: data ?? [],
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message });
  }
}
