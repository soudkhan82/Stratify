import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const iso3 = (searchParams.get("iso3") || "").toUpperCase().trim();

    if (!iso3) {
      return NextResponse.json({ error: "iso3 is required" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc(
      "fetch_faostat_country_profile",
      {
        p_iso3: iso3,
        p_top: 10,
      }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // RPC returns jsonb payload
    return NextResponse.json(data ?? {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
