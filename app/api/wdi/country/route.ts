import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const iso3 = (searchParams.get("iso3") || "").toUpperCase().trim();
  const indicator = (searchParams.get("indicator") || "").trim();

  if (!iso3 || !indicator) {
    return NextResponse.json(
      { error: "iso3 and indicator are required" },
      { status: 400 }
    );
  }

  // ✅ ONLY call the correct RPC, nothing else
  const { data, error } = await supabase.rpc("fetch_wdi_country_series", {
    p_iso3: iso3,
    p_indicator: indicator,
    p_window: 25,
  });

  if (error) {
    return NextResponse.json(
      { error: `fetch_wdi_country_series: ${error.message}` },
      { status: 500 }
    );
  }

  const rows = Array.isArray(data) ? (data as any[]) : [];

  const series = rows
    .map((r) => ({
      year: Number(r.year),
      value: Number(r.value),
      unit: r.unit ?? null,
    }))
    .filter((x) => Number.isFinite(x.year) && Number.isFinite(x.value))
    .sort((a, b) => a.year - b.year);

  const latest = series.length ? series[series.length - 1] : null;
  const first = rows[0];

  return NextResponse.json({
    iso3,
    country: first?.country ?? iso3,
    region: first?.region ?? null,
    indicator: {
      code: indicator,
      label: first?.indicator_label ?? indicator,
      unit: first?.unit ?? null,
    },
    latest,
    series,
  });
}
