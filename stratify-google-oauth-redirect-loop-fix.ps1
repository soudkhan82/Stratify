$ErrorActionPreference = "Stop"

$ProjectRoot = (Get-Location).Path
$LoginPath = Join-Path $ProjectRoot "app\login\page.tsx"
$ProxyPath = Join-Path $ProjectRoot "lib\supabase\proxy.ts"
$CallbackPath = Join-Path $ProjectRoot "app\auth\callback\route.ts"

foreach ($Path in @($LoginPath, $ProxyPath, $CallbackPath)) {
    if (-not (Test-Path $Path)) {
        throw "Required file not found: $Path"
    }
}

function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Content
    )

    [System.IO.File]::WriteAllText(
        $Path,
        $Content,
        (New-Object System.Text.UTF8Encoding($false))
    )
}

function Replace-Required {
    param(
        [Parameter(Mandatory = $true)][string]$Content,
        [Parameter(Mandatory = $true)][string]$OldText,
        [Parameter(Mandatory = $true)][string]$NewText,
        [Parameter(Mandatory = $true)][string]$Description
    )

    if (-not $Content.Contains($OldText)) {
        throw "Could not locate the expected block for: $Description"
    }

    return $Content.Replace($OldText, $NewText)
}

# ---------------------------------------------------------------------------
# 1. LOGIN PAGE
# Use an exact callback URL with no query string. Store the intended destination
# briefly in a same-site cookie instead, so Supabase's redirect allow-list does
# not reject the callback because of dynamic ?next= parameters.
# ---------------------------------------------------------------------------

$Login = Get-Content -Raw -Path $LoginPath

$OldLoginBlock = @'
      const params = new URLSearchParams(window.location.search);
      const nextPath = safeNextPath(params.get("next"));

      const { error } = await supabase.auth.signInWithOAuth({
'@

$NewLoginBlock = @'
      const params = new URLSearchParams(window.location.search);
      const nextPath = safeNextPath(params.get("next"));

      const secureCookie =
        window.location.protocol === "https:" ? "; Secure" : "";

      document.cookie = `stratify_auth_next=${encodeURIComponent(
        nextPath,
      )}; Path=/; Max-Age=600; SameSite=Lax${secureCookie}`;

      const configuredSiteUrl =
        process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");

      const siteUrl = configuredSiteUrl || window.location.origin;

      const { error } = await supabase.auth.signInWithOAuth({
'@

$Login = Replace-Required `
    -Content $Login `
    -OldText $OldLoginBlock `
    -NewText $NewLoginBlock `
    -Description "login destination cookie"

$OldRedirectTo = @'
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
            nextPath,
          )}`,
'@

$NewRedirectTo = @'
          redirectTo: `${siteUrl}/auth/callback`,
'@

$Login = Replace-Required `
    -Content $Login `
    -OldText $OldRedirectTo `
    -NewText $NewRedirectTo `
    -Description "exact OAuth callback URL"

Write-Utf8NoBom -Path $LoginPath -Content $Login

# ---------------------------------------------------------------------------
# 2. SESSION PROXY
# Recovery path: if Supabase ever falls back to the Site URL and puts ?code=...
# on another page, move that code to /auth/callback before authentication is
# checked. This prevents the /login?next=/?code=... loop shown in the browser.
# ---------------------------------------------------------------------------

$Proxy = Get-Content -Raw -Path $ProxyPath

$OldProxyBlock = @'
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const publicPath = isPublicPath(pathname);
'@

$NewProxyBlock = @'
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
'@

$Proxy = Replace-Required `
    -Content $Proxy `
    -OldText $OldProxyBlock `
    -NewText $NewProxyBlock `
    -Description "OAuth code recovery in proxy"

Write-Utf8NoBom -Path $ProxyPath -Content $Proxy

# ---------------------------------------------------------------------------
# 3. CALLBACK ROUTE
# Read the intended page from the short-lived cookie, exchange the code, then
# remove the cookie after the successful redirect.
# ---------------------------------------------------------------------------

$Callback = Get-Content -Raw -Path $CallbackPath

$OldImport = @'
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
'@

$NewImport = @'
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
'@

$Callback = Replace-Required `
    -Content $Callback `
    -OldText $OldImport `
    -NewText $NewImport `
    -Description "callback cookie import"

$OldNextPath = @'
  const nextPath = safeNextPath(requestUrl.searchParams.get("next"));
'@

$NewNextPath = @'
  const cookieStore = await cookies();
  const cookieNextValue =
    cookieStore.get("stratify_auth_next")?.value ?? null;

  let decodedCookieNext: string | null = cookieNextValue;

  if (cookieNextValue) {
    try {
      decodedCookieNext = decodeURIComponent(cookieNextValue);
    } catch {
      decodedCookieNext = null;
    }
  }

  const nextPath = safeNextPath(
    decodedCookieNext || requestUrl.searchParams.get("next"),
  );
'@

$Callback = Replace-Required `
    -Content $Callback `
    -OldText $OldNextPath `
    -NewText $NewNextPath `
    -Description "callback destination cookie read"

$OldFinalReturn = @'
  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
'@

$NewFinalReturn = @'
  const response = NextResponse.redirect(
    new URL(nextPath, requestUrl.origin),
  );

  response.cookies.set("stratify_auth_next", "", {
    path: "/",
    maxAge: 0,
  });

  return response;
}
'@

$Callback = Replace-Required `
    -Content $Callback `
    -OldText $OldFinalReturn `
    -NewText $NewFinalReturn `
    -Description "callback cookie cleanup"

Write-Utf8NoBom -Path $CallbackPath -Content $Callback

Write-Host ""
Write-Host "Google OAuth redirect-loop repair applied." -ForegroundColor Green
Write-Host ""
Write-Host "Updated:" -ForegroundColor Cyan
Write-Host "  app\login\page.tsx"
Write-Host "  lib\supabase\proxy.ts"
Write-Host "  app\auth\callback\route.ts"
Write-Host ""
Write-Host "Required production environment variable:" -ForegroundColor Yellow
Write-Host "  NEXT_PUBLIC_SITE_URL=https://worldstats360.com"
Write-Host ""
Write-Host "Supabase Redirect URL required:" -ForegroundColor Yellow
Write-Host "  https://worldstats360.com/auth/callback"
Write-Host ""
Write-Host "Next:" -ForegroundColor Yellow
Write-Host "  npm run build"
