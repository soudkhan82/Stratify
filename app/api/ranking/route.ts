// app/api/ranking/route.ts
import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const indicator = (searchParams.get("indicator") || "").trim();
    const region = (searchParams.get("region") || "").trim() || null;
    const limit = Number(searchParams.get("limit") || "250");

    if (!indicator) {
      return NextResponse.json({ error: "Missing indicator" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("fetch_wdi_ranking", {
      p_indicator: indicator,
      p_region: region,
      p_limit: Number.isFinite(limit)
        ? Math.max(10, Math.min(limit, 500))
        : 250,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rows: data ?? [] }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
