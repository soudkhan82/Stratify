import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const country = (searchParams.get("country") || "").toUpperCase();

  return NextResponse.json({
    ok: true,
    country,
    rows: [],
    summary: null,
    message: "cif route is working",
  });
}
