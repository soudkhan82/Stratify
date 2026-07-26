import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

function getRequestOrigin(request: Request) {
  const requestUrl = new URL(request.url);

  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();

  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();

  const host =
    forwardedHost ||
    request.headers.get("host") ||
    requestUrl.host;

  const protocol =
    forwardedProtocol ||
    requestUrl.protocol.replace(":", "");

  return `${protocol}://${host}`;
}

function authFailureRedirect(
  origin: string,
  errorCode: string,
) {
  const target = new URL("/", origin);
  target.searchParams.set("auth_error", errorCode);

  return NextResponse.redirect(target);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const requestOrigin = getRequestOrigin(request);
  const code = requestUrl.searchParams.get("code");

  const cookieStore = await cookies();
  const storedNext =
    cookieStore.get("stratify_auth_next")?.value ?? null;

  let decodedNext: string | null = storedNext;

  if (storedNext) {
    try {
      decodedNext = decodeURIComponent(storedNext);
    } catch {
      decodedNext = null;
    }
  }

  const nextPath = safeNextPath(decodedNext);

  if (!code) {
    console.error("SUPABASE OAUTH CALLBACK: missing code", {
      requestOrigin,
      requestUrl: requestUrl.toString(),
    });

    return authFailureRedirect(
      requestOrigin,
      "missing_oauth_code",
    );
  }

  const supabase = await createClient();

  const { data, error } =
    await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error("SUPABASE OAUTH EXCHANGE FAILED", {
      requestOrigin,
      message: error?.message ?? "No authenticated user returned",
      error,
    });

    return authFailureRedirect(
      requestOrigin,
      "google_signin_failed",
    );
  }

  const provider =
    data.user.app_metadata?.provider ||
    data.user.identities?.[0]?.provider ||
    "google";

  const forwardedFor = request.headers.get("x-forwarded-for");

  const ipAddress =
    forwardedFor?.split(",")?.[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;

  const userAgent =
    request.headers.get("user-agent") || null;

  const now = new Date().toISOString();

  /*
   * Visitor logging must never block successful authentication.
   */
  const loggingResults = await Promise.allSettled([
    supabase.from("profiles").upsert(
      {
        id: data.user.id,
        email: data.user.email,
        full_name:
          data.user.user_metadata?.full_name ||
          data.user.user_metadata?.name ||
          null,
        avatar_url:
          data.user.user_metadata?.avatar_url ||
          data.user.user_metadata?.picture ||
          null,
        provider,
        last_login_at: now,
      },
      {
        onConflict: "id",
      },
    ),

    supabase.from("user_login_events").insert({
      user_id: data.user.id,
      email: data.user.email,
      provider,
      ip_address: ipAddress,
      user_agent: userAgent,
    }),
  ]);

  loggingResults.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(
        index === 0
          ? "PROFILE VISITOR LOGGING FAILED"
          : "LOGIN EVENT LOGGING FAILED",
        result.reason,
      );
    }
  });

  const response = NextResponse.redirect(
    new URL(nextPath, requestOrigin),
  );

  response.cookies.set("stratify_auth_next", "", {
    path: "/",
    maxAge: 0,
  });

  return response;
}