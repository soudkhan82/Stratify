import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
function normDataset(v: string) {
  const d = (v || "").toLowerCase();
  return d === "production" || d === "sua" ? d : "";
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = String(searchParams.get("q") || "").trim();
    const lim = Math.max(1, Math.min(50, asInt(searchParams.get("lim"), 20)));
    const dataset = normDataset(String(searchParams.get("dataset") || ""));

    if (!q) {
      return NextResponse.json(
        { ok: true, rows: [] },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const like = `%${q}%`;
    const runProd = dataset ? dataset === "production" : true;
    const runSua = dataset ? dataset === "sua" : true;

    const [prodRes, suaRes] = await Promise.all([
      runProd
        ? supabase
            .from("faostat_production")
            .select(`"Item Code","Item"`)
            .ilike("Item", like)
            .limit(lim)
        : Promise.resolve({ data: [], error: null }),
      runSua
        ? supabase
            .from("faostat_sua")
            .select(`"Item Code","Item"`)
            .ilike("Item", like)
            .limit(lim)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const err = (prodRes as any).error || (suaRes as any).error;
    if (err) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    const prodRows =
      ((prodRes as any).data || []).map((r: any) => ({
        dataset: "production",
        item_code: String(r?.["Item Code"] ?? ""),
        item: String(r?.["Item"] ?? ""),
      })) ?? [];

    const suaRows =
      ((suaRes as any).data || []).map((r: any) => ({
        dataset: "sua",
        item_code: String(r?.["Item Code"] ?? ""),
        item: String(r?.["Item"] ?? ""),
      })) ?? [];

    const seen = new Set<string>();
    const rows = [...prodRows, ...suaRows]
      .filter((x) => x.item && x.item_code)
      .filter((x) => {
        const k = `${x.dataset}:${x.item_code}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort(
        (a, b) => a.item.length - b.item.length || a.item.localeCompare(b.item),
      )
      .slice(0, lim);

    return NextResponse.json(
      { ok: true, rows },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }
}
