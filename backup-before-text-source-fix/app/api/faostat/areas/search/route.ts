import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normDataset(v: string) {
  const d = (v || "").toLowerCase().trim();
  return d === "production" || d === "sua" ? d : "production";
}
function normText(v: string) {
  return String(v || "").trim();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const dataset = normDataset(
      String(searchParams.get("dataset") || "production"),
    );
    const q = normText(String(searchParams.get("q") || "")); // can be ''
    const lim = Math.max(
      5,
      Math.min(200, Number(searchParams.get("lim") || 50)),
    );

    const { data, error } = await supabase.rpc("fao_area_list", {
      dataset,
      q,
      lim,
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { ok: true, rows: Array.isArray(data) ? data : [] },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }
}
