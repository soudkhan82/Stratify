import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = new Set([
  "/landing",
  "/login",
  "/auth/callback",
]);

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.has(pathname);
}

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

function copyResponseCookies(
  source: NextResponse,
  destination: NextResponse,
) {
  source.cookies.getAll().forEach(
    ({ name, value, ...options }) => {
      destination.cookies.set(name, value, options);
    },
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          supabaseResponse = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(
            ({ name, value, options }) => {
              supabaseResponse.cookies.set(
                name,
                value,
                options,
              );
            },
          );
        },
      },
    },
  );

  const pathname = request.nextUrl.pathname;
  const authCode =
    request.nextUrl.searchParams.get("code");

  /*
   * Recover if an OAuth code ever lands on the wrong application path.
   * The origin is deliberately preserved.
   */
  if (authCode && pathname !== "/auth/callback") {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = "/auth/callback";

    const response = NextResponse.redirect(callbackUrl);
    copyResponseCookies(supabaseResponse, response);

    return response;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  /*
   * SIGNED-OUT EXPERIENCE
   */
  if (!user) {
    /*
     * Old /login URLs redirect to the root landing page.
     */
    if (pathname === "/login") {
      const rootUrl = request.nextUrl.clone();
      rootUrl.pathname = "/";

      const response = NextResponse.redirect(rootUrl);
      copyResponseCookies(supabaseResponse, response);

      return response;
    }

    /*
     * Keep "/" visible in the browser but internally render /landing.
     */
    if (pathname === "/") {
      const landingUrl = request.nextUrl.clone();
      landingUrl.pathname = "/landing";

      const response = NextResponse.rewrite(landingUrl);
      copyResponseCookies(supabaseResponse, response);

      return response;
    }

    /*
     * Protected modules return to the root landing page and retain
     * their intended destination.
     */
    if (!isPublicPath(pathname)) {
      const rootUrl = request.nextUrl.clone();

      const requestedDestination =
        `${pathname}${request.nextUrl.search}`;

      rootUrl.pathname = "/";
      rootUrl.search = "";
      rootUrl.searchParams.set(
        "next",
        requestedDestination,
      );

      const response = NextResponse.redirect(rootUrl);
      copyResponseCookies(supabaseResponse, response);

      return response;
    }

    return supabaseResponse;
  }

  /*
   * SIGNED-IN EXPERIENCE
   *
   * "/" remains the existing authenticated world-map dashboard.
   */
  if (
    pathname === "/login" ||
    pathname === "/landing"
  ) {
    const nextPath = safeNextPath(
      request.nextUrl.searchParams.get("next"),
    );

    const response = NextResponse.redirect(
      new URL(nextPath, request.url),
    );

    copyResponseCookies(supabaseResponse, response);

    return response;
  }

  return supabaseResponse;
}