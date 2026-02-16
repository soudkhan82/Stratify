import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data: indicators, error: indErr } = await supabase.rpc(
      "weo_available_indicators",
    );

    if (indErr) return NextResponse.json({ ok: false, error: indErr.message });

    const { data: vintages, error: vinErr } = await supabase.rpc(
      "weo_available_vintages",
    );

    if (vinErr) return NextResponse.json({ ok: false, error: vinErr.message });

    return NextResponse.json({
      ok: true,
      indicators: indicators ?? [],
      vintages: vintages ?? [],
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message });
  }
}
