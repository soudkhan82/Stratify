import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function copyResponseCookies(
  source: NextResponse,
  destination: NextResponse,
) {
  source.cookies.getAll().forEach(({ name, value, ...options }) => {
    destination.cookies.set(name, value, options);
  });
}

function hasSupabaseSessionCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some(
      ({ name }) =>
        name.startsWith("sb-") &&
        (name.includes("auth-token") || name.includes("refresh-token")),
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

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const pathname = request.nextUrl.pathname;
  const authCode = request.nextUrl.searchParams.get("code");

  // Preserve the OAuth callback hand-off if a provider returns the code
  // to another page unexpectedly.
  if (authCode && pathname !== "/auth/callback") {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = "/auth/callback";
    callbackUrl.search = "";
    callbackUrl.searchParams.set("code", authCode);

    const next = request.nextUrl.searchParams.get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      callbackUrl.searchParams.set("next", next);
    }

    const callbackResponse = NextResponse.redirect(callbackUrl);
    copyResponseCookies(supabaseResponse, callbackResponse);
    return callbackResponse;
  }

  // Authentication is OPTIONAL.
  // Public visitors are never redirected to /login.
  //
  // Only refresh/validate a Supabase session when a session cookie exists.
  // This avoids an unnecessary auth round-trip for anonymous visitors and
  // keeps public browsing fast.
  if (hasSupabaseSessionCookie(request)) {
    try {
      await supabase.auth.getUser();
    } catch (error) {
      console.error("Optional Supabase session refresh failed:", error);
    }
  }

  return supabaseResponse;
}
