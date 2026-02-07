import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normDataset(v: string) {
  const d = (v || "").toLowerCase();
  return d === "production" || d === "sua" ? d : "";
}
function normText(v: string) {
  const t = String(v || "").trim();
  return t ? t : "";
}
function toInt(v: string, def: number) {
  const n = Number(String(v || def));
  return Number.isFinite(n) ? Math.floor(n) : def;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const dataset = normDataset(String(searchParams.get("dataset") || ""));
    const item_code = normText(String(searchParams.get("item_code") || ""));
    const element = normText(String(searchParams.get("element") || ""));
    const year = toInt(String(searchParams.get("year") || ""), 0);
    const topn = Math.max(
      1,
      Math.min(50, toInt(String(searchParams.get("topn") || "10"), 10)),
    );

    if (!dataset || !item_code || !element || !year) {
      return NextResponse.json(
        { ok: false, error: "dataset, item_code, element, year are required" },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { data, error } = await supabase.rpc("fao_product_top_areas", {
      p_dataset: dataset,
      p_item_code: item_code,
      p_element: element,
      p_year: year,
      p_topn: topn,
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { ok: true, rows: Array.isArray(data) ? data : [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }
}
