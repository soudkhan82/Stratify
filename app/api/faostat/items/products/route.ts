// app/api/faostat/items/products/route.ts
import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Dataset = "production" | "sua";

function normDataset(v: string): Dataset | "" {
  const d = (v || "").toLowerCase();
  return d === "production" || d === "sua" ? (d as Dataset) : "";
}

function asInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const dataset = normDataset(String(searchParams.get("dataset") || ""));
    const element = String(searchParams.get("element") || "").trim();
    const year = asInt(searchParams.get("year"), 0);
    const area_code = String(searchParams.get("area_code") || "").trim();

    const limit = Math.min(
      Math.max(asInt(searchParams.get("limit"), 100), 1),
      500,
    );
    const offset = Math.max(asInt(searchParams.get("offset"), 0), 0);

    if (!dataset || !element || !year || !area_code) {
      return NextResponse.json(
        {
          ok: false,
          error: "dataset, element, year, area_code are required",
          rows: [],
        },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    // ✅ RPC (your existing function)
    const { data, error } = await supabase.rpc("fao_products_slice", {
      p_dataset: dataset,
      p_element: element,
      p_year: year,
      p_area_code: area_code, // keep as TEXT (RPC handles casting internally)
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message, rows: [] },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    const rows = Array.isArray(data)
      ? data.map((r: any) => ({
          dataset: String(r?.dataset ?? dataset),
          item_code: String(r?.item_code ?? ""),
          item: String(r?.item ?? ""),
          unit: r?.unit == null ? null : String(r.unit),
          value: r?.value == null ? null : String(r.value),
        }))
      : [];

    return NextResponse.json(
      { ok: true, rows },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error", rows: [] },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }
}
