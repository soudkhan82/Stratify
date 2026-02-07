import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normDataset(v: string) {
  const d = (v || "").toLowerCase().trim();
  return d === "production" || d === "sua" ? d : "";
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dataset = normDataset(String(searchParams.get("dataset") || ""));

    if (!dataset) {
      return NextResponse.json(
        { ok: false, error: "dataset is required (production|sua)" },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    // 1) Try cached meta table
    const metaRes = await supabase
      .from("faostat_dataset_meta")
      .select("dataset,min_year,max_year,elements_list,updated_at")
      .eq("dataset", dataset)
      .maybeSingle();

    // If found → return it
    if (metaRes.data && !metaRes.error) {
      const elements = Array.isArray((metaRes.data as any)?.elements_list)
        ? ((metaRes.data as any).elements_list as string[])
        : [];

      return NextResponse.json(
        {
          ok: true,
          meta: {
            dataset,
            min_year: Number((metaRes.data as any)?.min_year ?? 0),
            max_year: Number((metaRes.data as any)?.max_year ?? 0),
            elements,
          },
        },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    // 2) Fallback: compute directly from base table
    const table = dataset === "sua" ? "faostat_sua" : "faostat_production";

    const [minRes, maxRes, elRes] = await Promise.all([
      supabase
        .from(table)
        .select("Year")
        .order("Year", { ascending: true })
        .limit(1),
      supabase
        .from(table)
        .select("Year")
        .order("Year", { ascending: false })
        .limit(1),
      supabase
        .from(table)
        .select("Element")
        .not("Element", "is", null)
        .limit(5000),
    ]);

    const err = minRes.error || maxRes.error || elRes.error;
    if (err) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    const min_year = Number(minRes.data?.[0]?.Year ?? 0);
    const max_year = Number(maxRes.data?.[0]?.Year ?? 0);

    const elements = Array.from(
      new Set(
        (elRes.data || [])
          .map((r: any) => String(r?.Element ?? ""))
          .filter(Boolean),
      ),
    ).sort();

    return NextResponse.json(
      {
        ok: true,
        meta: {
          dataset,
          min_year,
          max_year,
          elements,
        },
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }
}
