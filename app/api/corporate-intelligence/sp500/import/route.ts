import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    ok: true,
    message: "S&P 500 import endpoint ready. Supabase insert logic will be added next.",
  });
}
