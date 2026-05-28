import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    ok: true,
    message: "Financial refresh endpoint ready. Alpha Vantage logic will be added next.",
  });
}
