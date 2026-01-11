import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Supabase RPC can return:
 * - object (json/jsonb)
 * - array (setof json)
 * - null
 * - sometimes stringified json (rare, but can happen via views/functions)
 */
function normalizeJsonPayload(
  data: unknown
): Record<string, unknown> | unknown[] {
  if (Array.isArray(data)) return data;
  if (isRecord(data)) return data;

  if (typeof data === "string") {
    try {
      const parsed: unknown = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
      if (isRecord(parsed)) return parsed;
    } catch {
      // fall through
    }
  }

  // fallback so API always returns JSON
  return {};
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const iso3 = (searchParams.get("iso3") || "").toUpperCase().trim();
    const indicator = (searchParams.get("indicator") || "SP.POP.TOTL").trim();

    if (!iso3) {
      return NextResponse.json({ error: "iso3 is required" }, { status: 400 });
    }

    // IMPORTANT: use the RPC signature you actually have
    // You earlier listed: fetch_landing_wdi(p_iso3 text, p_region text)
    // So we pass p_iso3 and p_region (null).
    const { data, error } = await supabase.rpc("fetch_landing_wdi", {
      p_iso3: iso3,
      p_region: null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const payload = normalizeJsonPayload(data);

    // Optionally attach indicator param if your RPC returns a bundle and
    // you want the client to know what was requested.
    if (isRecord(payload)) {
      return NextResponse.json({ ...payload, requested_indicator: indicator });
    }

    return NextResponse.json(payload);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
