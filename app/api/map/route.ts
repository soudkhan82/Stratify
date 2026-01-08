// app/api/map/route.ts
import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

/* =======================
   Types
======================= */

type MapRow = {
  iso3: string;
  country: string;
  region: string | null;
  value: number;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function coerceMapRows(payload: unknown): MapRow[] {
  if (!Array.isArray(payload)) return [];
  return payload.map((r): MapRow => {
    if (!isRecord(r)) return { iso3: "", country: "", region: null, value: 0 };
    return {
      iso3: asString(r.iso3),
      country: asString(r.country),
      region: typeof r.region === "string" ? r.region : null,
      value: asNumber(r.value),
    };
  });
}

/* =======================
   Handler
======================= */

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const indicator = searchParams.get("indicator") ?? "SP.POP.TOTL";
  const region = searchParams.get("region"); // optional ("ALL" or null allowed)

  const p_region =
    !region || region === "ALL" || region === "null" || region === "undefined"
      ? null
      : region;

  // ✅ Correct RPC that exists in your DB:
  // public.fetch_map_wdi(p_indicator text, p_region text)
  const { data, error } = await supabase.rpc("fetch_map_wdi", {
    p_indicator: indicator,
    p_region,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message, rows: [] },
      { status: 500 }
    );
  }

  const rows = coerceMapRows(data as unknown);
  return NextResponse.json({ rows });
}
