$ErrorActionPreference = "Stop"

$ProjectRoot = (Get-Location).Path

if (-not (Test-Path (Join-Path $ProjectRoot "package.json"))) {
    throw "Run this script from the Stratify project root, for example: C:\NextJS\stratify"
}

function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Content
    )

    $parent = Split-Path -Parent $Path
    if ($parent -and -not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    [System.IO.File]::WriteAllText(
        $Path,
        $Content,
        (New-Object System.Text.UTF8Encoding($false))
    )
}

$SupabaseProxy = @'
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
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
'@

$RootProxy = @'
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2)$).*)",
  ],
};
'@

$LoginPage = @'
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function signInWithGoogle() {
    setLoading(true);
    setErrorMessage("");

    try {
      const supabase = createClient();
      const params = new URLSearchParams(window.location.search);
      const nextPath = safeNextPath(params.get("next"));

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
            nextPath,
          )}`,
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to start Google sign-in.",
      );
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#020617] px-4">
      <div className="w-full max-w-md rounded-3xl border border-emerald-500/20 bg-slate-950 p-8 shadow-2xl">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-2xl">
            🌍
          </div>

          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-400">
            WorldStats360
          </p>

          <h1 className="mt-2 text-3xl font-bold text-white">
            Welcome to Stratify
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-400">
            Google sign-in is required to access the analytical portal.
          </p>
        </div>

        {errorMessage ? (
          <div className="mt-6 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {errorMessage}
          </div>
        ) : null}

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={loading}
          className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="text-lg font-bold">G</span>
          {loading ? "Redirecting..." : "Continue with Google"}
        </button>

        <p className="mt-6 text-center text-xs leading-5 text-slate-500">
          Your account is used to identify unique portal users and maintain
          secure access.
        </p>
      </div>
    </main>
  );
}
'@

$CallbackRoute = @'
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
'@

Write-Utf8NoBom `
    -Path (Join-Path $ProjectRoot "lib\supabase\proxy.ts") `
    -Content $SupabaseProxy

Write-Utf8NoBom `
    -Path (Join-Path $ProjectRoot "proxy.ts") `
    -Content $RootProxy

Write-Utf8NoBom `
    -Path (Join-Path $ProjectRoot "app\login\page.tsx") `
    -Content $LoginPage

Write-Utf8NoBom `
    -Path (Join-Path $ProjectRoot "app\auth\callback\route.ts") `
    -Content $CallbackRoute

Write-Host ""
Write-Host "Mandatory Google sign-in patch applied successfully." -ForegroundColor Green
Write-Host "Updated:" -ForegroundColor Cyan
Write-Host "  lib\supabase\proxy.ts"
Write-Host "  proxy.ts"
Write-Host "  app\login\page.tsx"
Write-Host "  app\auth\callback\route.ts"
Write-Host ""
Write-Host "Next commands:" -ForegroundColor Yellow
Write-Host "  npm run build"
Write-Host "  npm run dev"
