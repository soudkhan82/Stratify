import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getGooglePlaceReviews,
} from "@/app/lib/google-places";

export const runtime =
  "nodejs";
export const dynamic =
  "force-dynamic";

export async function GET(
  request: NextRequest,
) {
  try {
    const placeId =
      request.nextUrl
        .searchParams.get(
          "placeId",
        )
        ?.trim() ??
      "";

    if (!placeId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "placeId is required.",
        },
        {
          status: 400,
        },
      );
    }

    const reviews =
      await getGooglePlaceReviews(
        placeId,
      );

    return NextResponse.json(
      {
        ok: true,
        reviews,
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
            : "Unable to load reviews.",
        reviews: [],
      },
      {
        status: 500,
      },
    );
  }
}