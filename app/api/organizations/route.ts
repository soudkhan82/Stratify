import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  searchGooglePlaces,
} from "@/app/lib/google-places";

export const runtime =
  "nodejs";
export const dynamic =
  "force-dynamic";

function clean(
  value: string | null,
) {
  return String(
    value ?? "",
  ).trim();
}

export async function GET(
  request: NextRequest,
) {
  try {
    const params =
      request.nextUrl
        .searchParams;

    const location =
      clean(
        params.get(
          "location",
        ),
      );

    if (
      location.length < 2
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Enter a country, city or region before searching Google Places.",
          places: [],
          organizations: [],
        },
        {
          status: 400,
        },
      );
    }

    const result =
      await searchGooglePlaces(
        {
          sector:
            clean(
              params.get(
                "sector",
              ),
            ) ||
            "agriculture",
          category:
            params.get(
              "category",
            ),
          tag:
            params.get(
              "tag",
            ),
          q:
            params.get(
              "q",
            ),
          location,
          limit:
            Number(
              params.get(
                "limit",
              ) ??
                60,
            ),
        },
      );

    return NextResponse.json(
      {
        ok: true,
        source:
          result.source,
        sector:
          result.sector,
        sectorLabel:
          result.sectorLabel,
        category:
          result.category,
        categoryLabel:
          result.categoryLabel,
        location:
          result.location,
        queryCount:
          result.queryCount,
        queries:
          result.queries,
        totalMatches:
          result.totalMatches,
        count:
          result.places
            .length,
        places:
          result.places,
        organizations:
          result.places,
        partialErrors:
          result.errors,
        sourcePolicy:
          "Live Google Places (New) results. Stratify does not persist Google Places content; place details are requested on demand.",
      },
      {
        headers: {
          "Cache-Control":
            "private, no-store, max-age=0",
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
            : "Unable to search Google Places.",
        places: [],
        organizations: [],
      },
      {
        status: 500,
      },
    );
  }
}
