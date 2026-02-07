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
    const item_code = String(searchParams.get("item_code") || "").trim(); // ✅ new
    const element = String(searchParams.get("element") || "").trim();
    const area_code = String(searchParams.get("area_code") || "").trim();

    // ✅ accept BOTH end_year (new) and year (old)
    const end_year =
      asInt(searchParams.get("end_year"), 0) ||
      asInt(searchParams.get("year"), 0);

    // ✅ accept years (old)
    const years = Math.min(
      Math.max(asInt(searchParams.get("years"), 5), 1),
      60,
    );

    if (!dataset || !element || !area_code) {
      return NextResponse.json(
        {
          ok: false,
          error: "dataset, element, area_code are required",
          rows: [],
        },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    // if item_code missing, return the exact message you saw (so you know it's still wrong calls)
    if (!item_code) {
      return NextResponse.json(
        { ok: false, error: "item_code is required", rows: [] },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    const windowYears = end_year ? 5 : years;
    const startY = end_year ? end_year - (windowYears - 1) : null;

    if (dataset === "sua") {
      const ac = Number(area_code);
      const ic = Number(item_code);
      if (!Number.isFinite(ac) || !Number.isFinite(ic)) {
        return NextResponse.json(
          {
            ok: false,
            error: "For SUA, area_code and item_code must be numeric",
            rows: [],
          },
          { status: 200, headers: { "Cache-Control": "no-store" } },
        );
      }

      let q = supabase
        .from("faostat_sua")
        .select(`"Year","Value"`)
        .eq("Area Code", ac)
        .eq("Item Code", ic)
        .eq("Element", element);

      if (end_year) q = q.gte("Year", startY!).lte("Year", end_year);
      else q = q.order("Year", { ascending: false }).limit(windowYears);

      const { data, error } = await q;
      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message, rows: [] },
          { status: 200, headers: { "Cache-Control": "no-store" } },
        );
      }

      const rows = (data || [])
        .map((r: any) => ({ year: Number(r?.["Year"]), value: r?.["Value"] }))
        .sort((a, b) => a.year - b.year);

      return NextResponse.json(
        { ok: true, rows },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    // production
    let qp = supabase
      .from("faostat_production")
      .select(`"Year","Value"`)
      .eq("Area Code", area_code)
      .eq("Item Code", item_code)
      .eq("Element", element);

    if (end_year) qp = qp.gte("Year", startY!).lte("Year", end_year);
    else qp = qp.order("Year", { ascending: false }).limit(windowYears);

    const { data, error } = await qp;

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message, rows: [] },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    const rows = (data || [])
      .map((r: any) => ({ year: Number(r?.["Year"]), value: r?.["Value"] }))
      .sort((a, b) => a.year - b.year);

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
