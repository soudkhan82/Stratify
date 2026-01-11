import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const iso3 = (searchParams.get("iso3") || "").toUpperCase().trim();
  if (!iso3)
    return NextResponse.json({ error: "iso3 is required" }, { status: 400 });

  const { data, error } = await supabase.rpc("fetch_faostat_overview_iso3", {
    p_iso3: iso3,
  });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? {});
}
