// app/api/fiscal/interest-revenue/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const META = {
  slug: "interest-revenue",
  title: "Interest Payments",
  subtitle: "Interest payments • % of revenue (not yet available in dataset)",
  unit: "% of revenue",
  fmt: "pct" as const,
};

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      meta: META,
      error: "Indicator not available in your WEO dataset yet.",
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
