// app/api/debt/route.ts
import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normText(v: string | null, fallback: string | null = null) {
  const t = String(v ?? "").trim();
  return t ? t : fallback;
}
function normInt(v: string | null, fallback: number | null) {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const region = normText(searchParams.get("region"), null); // or "ALL"
    const year = normInt(searchParams.get("year"), null);
    const top = normInt(searchParams.get("top"), 50) ?? 50;

    const iso3 = normText(searchParams.get("iso3"), null);
    const from = normInt(searchParams.get("from"), 1980) ?? 1980;
    const to = normInt(searchParams.get("to"), 2030) ?? 2030;

    // 1) latest vintage
    const { data: vRows, error: vErr } =
      await supabase.rpc("weo_latest_vintage");
    if (vErr) {
      return NextResponse.json(
        { ok: false, error: vErr.message },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }
    const vintage = vRows?.[0]?.vintage ?? "WEO_2025_10";

    // 2) ranking
    const { data: ranking, error: rErr } = await supabase.rpc("weo_debt_rank", {
      in_region: region,
      in_year: year,
      in_top: top,
      in_vintage: vintage,
    });

    if (rErr) {
      return NextResponse.json(
        { ok: false, error: rErr.message },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    const safeRanking = Array.isArray(ranking) ? ranking : [];
    const rankYear = safeRanking?.[0]?.year ?? year ?? null;

    // 3) optional series
    let series: any[] = [];
    let countryMeta: any = null;

    if (iso3) {
      // simple metadata from your final view
      const { data: cRows, error: cErr } = await supabase
        .from("v_country_dim_final")
        .select("country_code,country_name,region")
        .eq("country_code", iso3)
        .limit(1);

      if (!cErr) countryMeta = cRows?.[0] ?? null;

      const { data: sRows, error: sErr } = await supabase.rpc(
        "weo_debt_series",
        {
          in_country: iso3,
          in_from: from,
          in_to: to,
          in_vintage: vintage,
        },
      );

      if (sErr) {
        return NextResponse.json(
          { ok: false, error: sErr.message },
          { status: 200, headers: { "Cache-Control": "no-store" } },
        );
      }
      series = Array.isArray(sRows) ? sRows : [];
    }

    // 4) totals (countries) – quick count from ranking (or build a separate RPC if you want full 206 always)
    const countries = safeRanking.length
      ? new Set(safeRanking.map((x: any) => x.country_code)).size
      : 0;

    return NextResponse.json(
      {
        ok: true,
        vintage,
        rank_year: rankYear,
        totals: { countries },
        ranking: safeRanking,
        series: {
          country: countryMeta,
          min_year: from,
          max_year: to,
          points: series, // [{year,value}]
        },
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }
}
