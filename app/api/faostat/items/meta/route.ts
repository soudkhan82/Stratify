import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normDataset(v: string) {
  const d = (v || "").toLowerCase();
  return d === "production" || d === "sua" ? d : "";
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dataset = normDataset(String(searchParams.get("dataset") || ""));
    const item_code = String(searchParams.get("item_code") || "").trim();

    if (!dataset || !item_code) {
      return NextResponse.json(
        { ok: false, error: "dataset and item_code are required" },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    const table = dataset === "sua" ? "faostat_sua" : "faostat_production";
    const itemCodeVal: any = dataset === "sua" ? Number(item_code) : item_code;

    // Min year + max year (fast using sort+limit)
    const [minRes, maxRes, sampleRes] = await Promise.all([
      supabase
        .from(table)
        .select(`"Year"`)
        .eq(`Item Code`, itemCodeVal)
        .order("Year", { ascending: true })
        .limit(1),
      supabase
        .from(table)
        .select(`"Year"`)
        .eq(`Item Code`, itemCodeVal)
        .order("Year", { ascending: false })
        .limit(1),
      // sample to derive distinct elements/units + item label
      supabase
        .from(table)
        .select(`"Item","Element","Unit"`)
        .eq(`Item Code`, itemCodeVal)
        .limit(5000),
    ]);

    const err = minRes.error || maxRes.error || sampleRes.error;
    if (err) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    const min_year = Number(minRes.data?.[0]?.["Year"] ?? 0);
    const max_year = Number(maxRes.data?.[0]?.["Year"] ?? 0);

    const itemName = String(
      sampleRes.data?.find((x: any) => x?.["Item"])?.["Item"] ?? "",
    );

    const elements = Array.from(
      new Set(
        (sampleRes.data || [])
          .map((r: any) => String(r?.["Element"] ?? ""))
          .filter(Boolean),
      ),
    ).sort();

    const units = Array.from(
      new Set(
        (sampleRes.data || [])
          .map((r: any) => String(r?.["Unit"] ?? ""))
          .filter(Boolean),
      ),
    ).sort();

    return NextResponse.json(
      {
        ok: true,
        meta: {
          dataset,
          item_code,
          item: itemName,
          min_year,
          max_year,
          elements,
          units,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }
}
