import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("v_ci_corporate_directory_summary")
      .select("*")
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      data: {
        totalCompanies: Number(data?.total_companies ?? 0),
        sectors: Number(data?.sectors ?? 0),
        industries: Number(data?.industries ?? 0),
        countries: Number(data?.countries ?? 0),
        enrichedCompanies: Number(data?.enriched_companies ?? 0),
        pendingCompanies: Number(data?.pending_companies ?? 0),
        lastRefreshAt: data?.last_refresh_at ?? null,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load corporate directory summary.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
        data: null,
      },
      { status: 500 }
    );
  }
}
