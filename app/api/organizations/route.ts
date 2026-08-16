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
            "Enter a country, city or region before searching.",
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
        totalMatches:
          result.totalMatches,
        count:
          result.places
            .length,
        places: result.places.map((place) => ({ ...place, source: "live", matchedQueries: [] })),
        organizations: result.places.map((place) => ({ ...place, source: "live", matchedQueries: [] })),
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
        error: "Unable to load organizations.",
        places: [],
        organizations: [],
      },
      {
        status: 500,
      },
    );
  }
}
