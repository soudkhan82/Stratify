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
  )
    .replace(/\s+/g, " ")
    .trim();
}

function roleCategory(
  role: string,
) {
  const normalized =
    role
      .trim()
      .toLowerCase();

  if (
    normalized.includes(
      "export",
    ) ||
    normalized.includes(
      "trader",
    )
  ) {
    return "exporter";
  }

  if (
    normalized.includes(
      "process",
    ) ||
    normalized.includes(
      "mill",
    )
  ) {
    return "processor";
  }

  if (
    normalized.includes(
      "input",
    ) ||
    normalized.includes(
      "fertil",
    ) ||
    normalized.includes(
      "seed",
    )
  ) {
    return "agri-inputs";
  }

  if (
    normalized.includes(
      "logistic",
    ) ||
    normalized.includes(
      "storage",
    ) ||
    normalized.includes(
      "warehouse",
    )
  ) {
    return "logistics";
  }

  if (
    normalized.includes(
      "supplier",
    ) ||
    normalized.includes(
      "wholesale",
    )
  ) {
    return "supplier";
  }

  return "all";
}

export async function GET(
  request: NextRequest,
) {
  try {
    const params =
      request.nextUrl
        .searchParams;

    const moduleKey =
      clean(
        params.get(
          "module",
        ),
      ) ||
      "agriculture";

    const item =
      clean(
        params.get(
          "item",
        ),
      );
    const group =
      clean(
        params.get(
          "group",
        ),
      );
    const role =
      clean(
        params.get(
          "role",
        ),
      );
    const q =
      clean(
        params.get(
          "q",
        ),
      );
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
          ok: true,
          module:
            moduleKey,
          item,
          group,
          location,
          directorySize:
            null,
          totalMatches: 0,
          count: 0,
          businesses: [],
          sourcePolicy:
            "Select a country to load live Google Places business matches.",
        },
        {
          headers: {
            "Cache-Control":
              "private, no-store, max-age=0",
          },
        },
      );
    }

    const result =
      await searchGooglePlaces(
        {
          sector:
            moduleKey,
          category:
            role
              ? roleCategory(
                  role,
                )
              : "all",
          tag:
            item ||
            null,
          q:
            q ||
            null,
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

    const businesses =
      result.places.map(
        (
          place,
          index,
        ) => ({
          id:
            place.id,
          organizationId:
            place.id,
          name:
            place.name,
          module:
            moduleKey,
          country:
            place.country ||
            location,
          countryCode:
            place.countryCode,
          city:
            place.city,
          lat:
            place.lat,
          lng:
            place.lng,
          coverage:
            location,
          roles:
            place
              .matchedServices,
          commerceGroups:
            group
              ? [group]
              : [],
          itemKeys:
            item
              ? [item]
              : [],
          description:
            `Live Google Places match for ${place.matchedQueries.join(
              " | ",
            )}.`,
          website:
            place.googleMapsUri,
          googleMapsUri:
            place.googleMapsUri,
          sourceUrl:
            place.googleMapsUri,
          verified: false,
          featured: false,
          sourceType:
            "google-places-new",
          verificationStatus:
            "google-live",
          locationPrecision:
            "google-place",
          matchType:
            "google-text-search",
          matchScore:
            Math.max(
              1,
              100 - index,
            ),
          primaryType:
            place.primaryType,
          types:
            place.types,
          businessStatus:
            place.businessStatus,
        }),
      );

    return NextResponse.json(
      {
        ok: true,
        source:
          "Google Places (New)",
        module:
          moduleKey,
        item,
        group,
        location,
        directorySize:
          null,
        totalMatches:
          businesses.length,
        count:
          businesses.length,
        businesses,
        queries:
          result.queries,
        partialErrors:
          result.errors,
        sourcePolicy:
          "Live Google Places (New) results. Google Maps attribution is required when these results are displayed.",
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
            : "Unable to load Google Places business matches.",
        businesses: [],
      },
      {
        status: 500,
      },
    );
  }
}
