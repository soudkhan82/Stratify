import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = new Set([
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
  source.cookies.getAll().forEach(({ name, value, ...options }) => {
    destination.cookies.set(name, value, options);
  });
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

  if (authCode && pathname !== "/auth/callback") {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = "/auth/callback";
    callbackUrl.search = "";
    callbackUrl.searchParams.set("code", authCode);

    const callbackResponse = NextResponse.redirect(callbackUrl);
    copyResponseCookies(supabaseResponse, callbackResponse);
    return callbackResponse;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const publicPath = isPublicPath(pathname);

  // Mandatory sign-in: every application page requires a valid Google/Supabase user.
  if (!user && !publicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set(
      "next",
      `${pathname}${request.nextUrl.search}`,
    );

    const redirectResponse = NextResponse.redirect(loginUrl);
    copyResponseCookies(supabaseResponse, redirectResponse);
    return redirectResponse;
  }

  // A signed-in user should not remain on the login screen.
  if (user && pathname === "/login") {
    const nextPath = safeNextPath(
      request.nextUrl.searchParams.get("next"),
    );

    const redirectResponse = NextResponse.redirect(
      new URL(nextPath, request.url),
    );

    copyResponseCookies(supabaseResponse, redirectResponse);
    return redirectResponse;
  }

  return supabaseResponse;
}