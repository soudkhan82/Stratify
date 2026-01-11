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
 * - sometimes stringified JSON (rare)
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
      // ignore
    }
  }

  return {};
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const iso3 = (searchParams.get("iso3") || "").toUpperCase().trim();

    if (!iso3) {
      return NextResponse.json({ error: "iso3 is required" }, { status: 400 });
    }

    // Your RPC name from earlier code:
    // fetch_faostat_country_profile(p_iso3 text, p_top int)
    const { data, error } = await supabase.rpc(
      "fetch_faostat_country_profile",
      { p_iso3: iso3, p_top: 10 }
    );

    if (error) {
      return NextResponse.json(
        { error: error.message, details: error.details ?? null },
        { status: 500 }
      );
    }

    const payload = normalizeJsonPayload(data);
    return NextResponse.json(payload);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
