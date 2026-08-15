import {
  NextRequest,
  NextResponse,
} from "next/server";

export const runtime =
  "nodejs";
export const dynamic =
  "force-dynamic";

const GOOGLE_TEXT_SEARCH_URL =
  "https://places.googleapis.com/v1/places:searchText";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.primaryType",
].join(",");

export async function GET(
  request: NextRequest,
) {
  const apiKey =
    process.env
      .GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "GOOGLE_PLACES_API_KEY is missing from .env.local",
      },
      {
        status: 500,
      },
    );
  }

  const q =
    request.nextUrl
      .searchParams.get(
        "q",
      )
      ?.trim() ||
    "agricultural suppliers in Islamabad";

  try {
    const response =
      await fetch(
        GOOGLE_TEXT_SEARCH_URL,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            "X-Goog-Api-Key":
              apiKey,
            "X-Goog-FieldMask":
              FIELD_MASK,
          },
          body:
            JSON.stringify(
              {
                textQuery: q,
                maxResultCount:
                  10,
              },
            ),
          cache: "no-store",
        },
      );

    const raw =
      await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          query: q,
          googleStatus:
            response.status,
          error:
            raw?.error ??
            raw,
        },
        {
          status:
            response.status,
        },
      );
    }

    const places =
      Array.isArray(
        raw?.places,
      )
        ? raw.places.map(
            (
              place: any,
            ) => ({
              id:
                place?.id ??
                null,
              name:
                place
                  ?.displayName
                  ?.text ??
                null,
              address:
                place
                  ?.formattedAddress ??
                null,
              primaryType:
                place
                  ?.primaryType ??
                null,
              location:
                place
                  ?.location ??
                null,
            }),
          )
        : [];

    return NextResponse.json(
      {
        ok: true,
        query: q,
        count:
          places.length,
        places,
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        query: q,
        error:
          error instanceof Error
            ? error.message
            : "Google Places request failed.",
      },
      {
        status: 500,
      },
    );
  }
}
