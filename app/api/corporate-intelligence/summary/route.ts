import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    data: {
      totalCompanies: 0,
      sectors: 0,
      totalMarketCap: 0,
      totalRevenueTtm: 0,
      avgPeRatio: 0,
      topCompany: null,
      lastFetchedAt: null,
    },
  });
}
