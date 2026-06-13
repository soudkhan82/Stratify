// app/api/fiscal/overall-balance/route.ts
import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normText(v: string | null) {
  const t = String(v ?? "").trim();
  return t ? t : null;
}
function normInt(v: string | null, fallback: number | null) {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

const INDICATOR_CODE = "GGSB_NPGDP";
const META = {
  slug: "overall-balance",
  title: "Overall Balance (Proxy)",
  subtitle: "Structural balance • % (proxy until overall balance is ingested)",
  unit: "% of GDP",
  fmt: "pct" as const,
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const country = normText(searchParams.get("country"));
    const region = normText(searchParams.get("region"));
    const year = normInt(searchParams.get("year"), null);
    const top = normInt(searchParams.get("top"), 50) ?? 50;

    const from = normInt(searchParams.get("from"), 1980) ?? 1980;
    const to = normInt(searchParams.get("to"), 2030) ?? 2030;

    const { data, error } = await supabase.rpc("weo_metric_rank_series", {
      in_indicator_code: INDICATOR_CODE,
      in_region: region,
      in_year: year,
      in_top: top,
      in_country: country,
      in_from: from,
      in_to: to,
      in_vintage: null,
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message, meta: META },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { ok: true, meta: META, ...data },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error", meta: META },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }
}
