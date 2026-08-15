import {
  NextRequest,
  NextResponse,
} from "next/server";

export const runtime =
  "nodejs";
export const dynamic =
  "force-dynamic";

export async function GET(
  request: NextRequest,
) {
  try {
    const apiKey =
      process.env
        .GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "GOOGLE_PLACES_API_KEY is not configured.",
        },
        {
          status: 500,
        },
      );
    }

    const name =
      request.nextUrl
        .searchParams.get(
          "name",
        )
        ?.trim() ??
      "";

    if (
      !/^places\/[^/]+\/photos\/[^/]+$/.test(
        name,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid Google photo resource name.",
        },
        {
          status: 400,
        },
      );
    }

    const requestedWidth =
      Number(
        request.nextUrl
          .searchParams.get(
            "width",
          ) ??
          480,
      );

    const width =
      Math.max(
        120,
        Math.min(
          1200,
          Number.isFinite(
            requestedWidth,
          )
            ? Math.trunc(
                requestedWidth,
              )
            : 480,
        ),
      );

    const url =
      new URL(
        `https://places.googleapis.com/v1/${name}/media`,
      );

    url.searchParams.set(
      "maxWidthPx",
      String(width),
    );
    url.searchParams.set(
      "skipHttpRedirect",
      "true",
    );
    url.searchParams.set(
      "key",
      apiKey,
    );

    const response =
      await fetch(
        url,
        {
          cache: "no-store",
        },
      );

    const payload =
      await response.json();

    if (
      !response.ok ||
      !payload?.photoUri
    ) {
      return NextResponse.json(
        {
          error:
            "Unable to load Google Place photo.",
        },
        {
          status:
            response.status ||
            500,
        },
      );
    }

    const redirect =
      NextResponse.redirect(
        payload.photoUri,
        302,
      );

    redirect.headers.set(
      "Cache-Control",
      "private, no-store, max-age=0",
    );

    return redirect;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load Google Place photo.",
      },
      {
        status: 500,
      },
    );
  }
}