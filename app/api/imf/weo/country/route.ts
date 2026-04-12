import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WeoRpcRow = {
  year: number | string | null;
  value: number | string | null;
  vintage?: string | null;
  country?: string | null;
  iso3?: string | null;
  indicator_code?: string | null;
  indicator_label?: string | null;
};

function normalizePoints(rows: WeoRpcRow[] | null | undefined) {
  return (rows || [])
    .map((row) => ({
      year: Number(row.year),
      value: Number(row.value),
    }))
    .filter((row) => Number.isFinite(row.year) && Number.isFinite(row.value))
    .sort((a, b) => a.year - b.year);
}

async function getLatestVintage(): Promise<string | null> {
  const { data, error } = await supabase.rpc("weo_latest_vintage");

  if (error) {
    console.error("weo_latest_vintage failed:", error.message);
    return null;
  }

  if (typeof data === "string") return data;

  if (Array.isArray(data) && data.length > 0) {
    const first = data[0] as {
      weo_latest_vintage?: string;
      vintage?: string;
    };
    return first.weo_latest_vintage || first.vintage || null;
  }

  if (data && typeof data === "object") {
    const row = data as {
      weo_latest_vintage?: string;
      vintage?: string;
    };
    return row.weo_latest_vintage || row.vintage || null;
  }

  return null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const iso3 = String(searchParams.get("iso3") || "")
      .trim()
      .toUpperCase();

    const indicator = String(searchParams.get("indicator") || "")
      .trim()
      .toUpperCase();

    let vintage = String(searchParams.get("vintage") || "").trim();

    if (!iso3 || !indicator) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing iso3 or indicator",
          points: [],
        },
        { status: 400 },
      );
    }

    if (!vintage) {
      const latestVintage = await getLatestVintage();
      if (latestVintage) {
        vintage = latestVintage;
      }
    }

    if (!vintage) {
      return NextResponse.json(
        {
          ok: false,
          error: "Could not resolve WEO vintage",
          points: [],
        },
        { status: 500 },
      );
    }

    const { data, error } = await supabase.rpc("weo_country_series", {
      p_iso3: iso3,
      p_indicator: indicator,
      p_vintage: vintage,
    });

    if (error) {
      console.error("weo_country_series failed:", error.message);

      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          points: [],
        },
        { status: 500 },
      );
    }

    const rows = (data || []) as WeoRpcRow[];
    const points = normalizePoints(rows);

    return NextResponse.json({
      ok: true,
      iso3,
      country: rows[0]?.country || iso3,
      indicator_code: rows[0]?.indicator_code || indicator,
      indicator_label: rows[0]?.indicator_label || indicator,
      vintage: rows[0]?.vintage || vintage,
      points,
      points_returned: points.length,
    });
  } catch (error) {
    console.error("IMF WEO route failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
        points: [],
      },
      { status: 500 },
    );
  }
}
