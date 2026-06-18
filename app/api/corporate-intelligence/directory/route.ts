import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("v_ci_corporate_directory_enriched")
      .select("*")
      .order("company_name", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      data: data ?? [],
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to load corporate directory.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
        data: [],
      },
      { status: 500 },
    );
  }
}
