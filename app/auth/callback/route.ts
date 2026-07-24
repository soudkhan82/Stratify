import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = safeNextPath(requestUrl.searchParams.get("next"));

  if (!code) {
    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("error", "missing_oauth_code");
    return NextResponse.redirect(loginUrl);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("error", "google_signin_failed");
    return NextResponse.redirect(loginUrl);
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

  const userAgent = request.headers.get("user-agent") || null;
  const now = new Date().toISOString();

  // Visitor logging must never block a successful login.
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

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}