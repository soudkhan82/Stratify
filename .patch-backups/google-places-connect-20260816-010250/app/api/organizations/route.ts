import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  searchOrganizations,
} from "@/app/lib/organization-network";

export const runtime =
  "nodejs";
export const dynamic =
  "force-dynamic";

function boolParam(
  value: string | null,
) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
}

export async function GET(
  request: NextRequest,
) {
  try {
    const params =
      request.nextUrl
        .searchParams;

    const result =
      await searchOrganizations(
        {
          sector:
            params.get(
              "sector",
            ),
          subsector:
            params.get(
              "subsector",
            ),
          service:
            params.get(
              "service",
            ),
          tag:
            params.get(
              "tag",
            ),
          country:
            params.get(
              "country",
            ),
          q:
            params.get(
              "q",
            ),
          verified:
            boolParam(
              params.get(
                "verified",
              ),
            ),
          limit:
            Number(
              params.get(
                "limit",
              ) ??
                100,
            ),
          offset:
            Number(
              params.get(
                "offset",
              ) ??
                0,
            ),
        },
      );

    return NextResponse.json(
      {
        ok: true,
        schemaVersion:
          result.payload
            .schemaVersion,
        generatedAt:
          result.payload
            .generatedAt,
        sourcePolicy:
          result.payload
            .sourcePolicy,
        directorySize:
          result.payload
            .organizations
            .length,
        totalMatches:
          result.totalMatches,
        count:
          result.page.length,
        offset:
          result.offset,
        limit:
          result.limit,
        facets:
          result.facets,
        organizations:
          result.page,
      },
      {
        headers: {
          "Cache-Control":
            "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load organization network.",
        organizations: [],
      },
      {
        status: 500,
      },
    );
  }
}
