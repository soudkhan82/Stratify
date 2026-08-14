import { NextResponse } from "next/server";

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      mode: "static-local-cache",
      source: "FAOSTAT Crops and livestock products (QCL)",
      message:
        "Agriculture Atlas now serves compact FAOSTAT bulk snapshots from /data/agriculture/*.json. The live authenticated FAOSTAT API is no longer used at page runtime.",
    },
    {
      headers: {
        "Cache-Control":
          "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}