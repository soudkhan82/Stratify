// app/api/faostat/country/route.ts
import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function normalizeRpc(data: unknown): Record<string, unknown> | unknown[] {
  if (Array.isArray(data)) return data;
  if (isRecord(data)) return data;

  if (typeof data === "string") {
    try {
      const parsed: unknown = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
      if (isRecord(parsed)) return parsed;
    } catch {}
  }
  return { ok: false, error: "RPC returned empty/unknown payload" };
}

function pickFirstAreaCode(obj: any): string | null {
  // In case RPC already returns something useful, we’ll try to read it too
  const candidates = [
    obj?.area_code,
    obj?.fao_area_code,
    obj?.fao_area_code_m49,
    obj?.areaCode,
    obj?.AreaCode,
    obj?.["Area Code"],
  ];
  for (const c of candidates) {
    if (c === null || c === undefined) continue;
    const s = String(c).trim();
    if (s) return s;
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const iso3 = String(searchParams.get("iso3") || "")
      .toUpperCase()
      .trim();

    if (!iso3) {
      return NextResponse.json({ error: "iso3 is required" }, { status: 400 });
    }

    // 1) ✅ Always fetch FAO mapping (iso3 -> fao_area_code)
    const { data: mapRow, error: mapErr } = await supabase
      .from("country_fao_map")
      .select("iso3, fao_area, fao_area_code")
      .eq("iso3", iso3)
      .maybeSingle();

    // 2) Existing RPC (profile) — keep it
    const { data: rpcData, error: rpcErr } = await supabase.rpc(
      "fetch_faostat_country_profile",
      {
        p_iso3: iso3,
        p_top: 10,
      },
    );

    const profile = normalizeRpc(rpcData);

    // Determine area_code
    const mappedAreaCode = mapRow?.fao_area_code
      ? String(mapRow.fao_area_code).trim()
      : null;

    const rpcAreaCode = isRecord(profile) ? pickFirstAreaCode(profile) : null;

    const area_code = mappedAreaCode || rpcAreaCode || null;

    // If mapping query itself failed, still return profile but include warning
    const mapping_warning = mapErr ? mapErr.message : null;

    // If RPC failed, still return mapping + rpc error info (don’t hard fail)
    const rpc_error = rpcErr
      ? { message: rpcErr.message, details: rpcErr.details ?? null }
      : null;

    return NextResponse.json(
      {
        ok: true,
        iso3,
        country: mapRow?.fao_area ?? null,
        area_code,
        mapping_warning,
        rpc_error,
        profile,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e: any) {
    const msg = e?.message || "Unknown error";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }
}
