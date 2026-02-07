import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalize(data: any) {
  // RPC may return object or stringified json depending on your setup
  if (!data) return null;
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return data;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const iso3 = String(searchParams.get("iso3") || "")
    .trim()
    .toUpperCase();
  const kind = String(searchParams.get("kind") || "").trim();
  const top = Number(searchParams.get("top") || 10);

  if (!iso3 || !kind) {
    return NextResponse.json(
      { ok: false, items: [], error: "iso3/kind required" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.rpc("fetch_faostat_module", {
    p_iso3: iso3,
    p_kind: kind,
    p_top: top,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, items: [], error: error.message },
      { status: 500 },
    );
  }

  const payload = normalize(data);

  // expected: { ok, iso3, country, latest_year, kind, items: [...] }
  return NextResponse.json(
    payload ?? { ok: false, items: [], error: "Empty RPC payload" },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
