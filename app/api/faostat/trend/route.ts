// app/api/faostat/trend/route.ts
import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const dataset = String(
      searchParams.get("dataset") || "production",
    ).toLowerCase(); // production | sua
    const areaCode = searchParams.get("area_code");
    const itemCode = searchParams.get("item_code");
    const element = searchParams.get("element"); // optional
    const yearFrom = searchParams.get("year_from");
    const yearTo = searchParams.get("year_to");
    const limit = Number(searchParams.get("limit") || 500);

    if (!areaCode || !itemCode) {
      return NextResponse.json(
        { ok: false, rows: [], error: "area_code and item_code are required" },
        { status: 400 },
      );
    }

    // If you already have a trend SQL function, call it here instead.
    // This version reads directly from tables (works immediately).
    const table = dataset === "sua" ? "faostat_sua" : "faostat_production";

    let q = supabase
      .from(table)
      .select(`"Year", "Value"`)
      .eq(`Area Code`, Number(areaCode))
      .eq(`Item Code`, Number(itemCode))
      .order(`Year`, { ascending: true })
      .limit(limit);

    if (element && element.trim()) q = q.eq("Element", element.trim());
    if (yearFrom) q = q.gte("Year", Number(yearFrom));
    if (yearTo) q = q.lte("Year", Number(yearTo));

    const { data, error } = await q;

    if (error) {
      return NextResponse.json(
        { ok: false, rows: [], error: error.message },
        { status: 500 },
      );
    }

    const rows = (data ?? [])
      .map((r: any) => ({
        year: Number(r["Year"]),
        value: r["Value"] === null ? null : Number(r["Value"]),
      }))
      .filter((r: any) => Number.isFinite(r.year));

    return NextResponse.json(
      { ok: true, rows },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e: any) {
    // ✅ Always JSON (prevents DOCTYPE errors)
    return NextResponse.json(
      { ok: false, rows: [], error: e?.message || "Unknown trend error" },
      { status: 500 },
    );
  }
}
