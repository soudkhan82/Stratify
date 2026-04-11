import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type WeoRpcRow = {
  year: number;
  value: number | null;
  indicator_code?: string;
  indicator_label?: string;
  unit?: string;
  country?: string;
  iso3?: string;
  vintage?: string;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const iso3 = String(searchParams.get("iso3") || "")
      .trim()
      .toUpperCase();

    const indicator = String(searchParams.get("indicator") || "").trim();

    // 🔥 HARDCODE OR DEFAULT VINTAGE (IMPORTANT)
    const vintage = String(searchParams.get("vintage") || "WEO_2025_10");

    if (!iso3 || !indicator) {
      return NextResponse.json(
        { ok: false, error: "Missing iso3 or indicator", rows: [] },
        { status: 400 },
      );
    }

    const { data, error } = await supabase.rpc("weo_country_series", {
      p_iso3: iso3,
      p_indicator: indicator,
      p_vintage: vintage,
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message, rows: [] },
        { status: 500 },
      );
    }

    const rows: WeoRpcRow[] = Array.isArray(data) ? data : [];

    if (rows.length === 0) {
      return NextResponse.json({
        ok: true,
        rows: [],
        iso3,
        indicator,
        vintage,
      });
    }

    const first = rows[0];

    const points = rows
      .map((r) => ({
        year: Number(r.year),
        value:
          r.value === null || r.value === undefined ? null : Number(r.value),
      }))
      .filter((p) => Number.isFinite(p.year))
      .sort((a, b) => a.year - b.year);

    return NextResponse.json({
      ok: true,
      rows: [
        {
          indicator_code: first.indicator_code ?? indicator,
          indicator_label: first.indicator_label ?? indicator,
          unit: first.unit ?? null,
          country: first.country ?? iso3,
          iso3: first.iso3 ?? iso3,
          vintage: first.vintage ?? vintage,
          points,
        },
      ],
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e.message, rows: [] },
      { status: 500 },
    );
  }
}
