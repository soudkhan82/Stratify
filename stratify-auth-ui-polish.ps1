$ErrorActionPreference = "Stop"

$ProjectRoot = (Get-Location).Path

if (-not (Test-Path (Join-Path $ProjectRoot "package.json"))) {
    throw "Run this script from the Stratify project root."
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

function GoogleLogo() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0"
    >
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.53h3.24c1.9-1.75 2.98-4.32 2.98-7.39Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.98-.9 6.64-2.38l-3.24-2.53c-.9.6-2.05.96-3.4.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.61A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.39 13.92A6 6 0 0 1 6.08 12c0-.67.11-1.32.31-1.92V7.47H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.53l3.35-2.61Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.88-2.88A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.96 5.47l3.35 2.61C7.18 7.71 9.39 5.95 12 5.95Z"
      />
    </svg>
  );
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
    <main
      className="relative isolate flex min-h-[calc(100vh-120px)] items-center justify-center overflow-hidden px-4 py-12"
      style={{
        background:
          "radial-gradient(circle at 20% 10%, rgba(99,102,241,0.20), transparent 32%), radial-gradient(circle at 85% 80%, rgba(14,165,233,0.14), transparent 30%), #020617",
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
        }}
      />

      <section
        className="relative w-full max-w-[480px] overflow-hidden rounded-[30px] border border-white/70 bg-white p-7 shadow-[0_30px_90px_rgba(0,0,0,0.45)] sm:p-9"
        style={{ color: "#0f172a" }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1.5"
          style={{
            background:
              "linear-gradient(90deg, #4f46e5, #7c3aed, #0ea5e9)",
          }}
        />

        <div className="text-center">
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-black text-white shadow-lg"
            style={{
              background:
                "linear-gradient(135deg, #4f46e5 0%, #7c3aed 55%, #2563eb 100%)",
            }}
          >
            S
          </div>

          <p
            className="mt-6 text-[11px] font-black uppercase tracking-[0.28em]"
            style={{ color: "#4f46e5" }}
          >
            Stratify Analytics
          </p>

          <h1
            className="mt-2 text-3xl font-black tracking-tight sm:text-[34px]"
            style={{ color: "#111827" }}
          >
            Sign in to continue
          </h1>

          <p
            className="mx-auto mt-3 max-w-sm text-sm font-medium leading-6"
            style={{ color: "#475569" }}
          >
            Access the World Intelligence Dashboard securely with your Google
            account.
          </p>
        </div>

        <div
          className="mt-7 rounded-2xl border px-4 py-3"
          style={{
            borderColor: "#e2e8f0",
            backgroundColor: "#f8fafc",
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black"
              style={{
                color: "#4338ca",
                backgroundColor: "#e0e7ff",
              }}
            >
              ✓
            </div>

            <div>
              <p
                className="text-sm font-bold"
                style={{ color: "#1e293b" }}
              >
                Secure authenticated access
              </p>
              <p
                className="mt-0.5 text-xs leading-5"
                style={{ color: "#64748b" }}
              >
                Sign-in helps protect the portal and measure genuine unique
                visitors.
              </p>
            </div>
          </div>
        </div>

        {errorMessage ? (
          <div
            className="mt-5 rounded-xl border px-4 py-3 text-sm font-semibold"
            style={{
              borderColor: "#fecdd3",
              backgroundColor: "#fff1f2",
              color: "#be123c",
            }}
          >
            {errorMessage}
          </div>
        ) : null}

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={loading}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl border px-5 py-3.5 text-sm font-bold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            borderColor: "#cbd5e1",
            backgroundColor: "#ffffff",
            color: "#0f172a",
          }}
        >
          {loading ? (
            <span
              className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600"
              aria-hidden="true"
            />
          ) : (
            <GoogleLogo />
          )}

          {loading ? "Redirecting to Google..." : "Continue with Google"}
        </button>

        <p
          className="mt-6 text-center text-[11px] font-medium leading-5"
          style={{ color: "#64748b" }}
        >
          Stratify never receives or stores your Google password.
        </p>
      </section>
    </main>
  );
}
'@

$AuthNavButton = @'
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AuthUser = {
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
};

function initialsFromUser(user: AuthUser) {
  const nameParts = String(user.fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (nameParts.length >= 2) {
    return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase();
  }

  if (nameParts.length === 1) {
    return nameParts[0].slice(0, 2).toUpperCase();
  }

  return String(user.email || "U").slice(0, 1).toUpperCase();
}

function firstNameFromUser(user: AuthUser) {
  const fullName = String(user.fullName || "").trim();

  if (fullName) {
    return fullName.split(/\s+/)[0];
  }

  return String(user.email || "User").split("@")[0];
}

export default function AuthNavButton() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (!authUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      const metadataName =
        authUser.user_metadata?.full_name ||
        authUser.user_metadata?.name ||
        null;

      const metadataAvatar =
        authUser.user_metadata?.picture ||
        authUser.user_metadata?.avatar_url ||
        null;

      let profileName: string | null = null;
      let profileAvatar: string | null = null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", authUser.id)
        .maybeSingle();

      if (profile) {
        profileName = profile.full_name || null;
        profileAvatar = profile.avatar_url || null;
      }

      if (!mounted) return;

      setAvatarFailed(false);
      setUser({
        email: authUser.email ?? null,
        fullName: metadataName || profileName,
        avatarUrl: metadataAvatar || profileAvatar,
      });
      setLoading(false);
    }

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadUser();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleLogout() {
    if (loggingOut) return;

    try {
      setLoggingOut(true);
      await supabase.auth.signOut();
      setUser(null);
      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-10 w-[152px] animate-pulse items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-2">
        <div className="h-7 w-7 rounded-full bg-slate-200" />
        <div className="h-3 w-16 rounded bg-slate-200" />
      </div>
    );
  }

  if (!user) {
    return (
      <a
        href="/login"
        className="inline-flex h-10 items-center justify-center rounded-full bg-violet-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-violet-700"
      >
        Sign in
      </a>
    );
  }

  const displayName = firstNameFromUser(user);
  const initials = initialsFromUser(user);
  const showAvatar = Boolean(user.avatarUrl) && !avatarFailed;

  return (
    <div
      className="flex h-11 items-center rounded-full border bg-white p-1 shadow-sm"
      style={{ borderColor: "#dbe3ef" }}
      title={user.email || displayName}
    >
      <div className="flex min-w-0 items-center gap-2 pl-0.5 pr-2">
        {showAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl!}
            alt={`${displayName} profile`}
            referrerPolicy="no-referrer"
            onError={() => setAvatarFailed(true)}
            className="h-8 w-8 shrink-0 rounded-full border border-slate-200 bg-slate-100 object-cover"
          />
        ) : (
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
            style={{
              background:
                "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
            }}
            aria-label={`${displayName} initials`}
          >
            {initials}
          </div>
        )}

        <div className="hidden min-w-0 leading-tight lg:block">
          <div
            className="max-w-[88px] truncate text-[12px] font-black"
            style={{ color: "#172033" }}
          >
            {displayName}
          </div>
          <div
            className="text-[9px] font-bold uppercase tracking-[0.08em]"
            style={{ color: "#16a34a" }}
          >
            Signed in
          </div>
        </div>
      </div>

      <div className="h-6 w-px bg-slate-200" />

      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        className="ml-1 inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-2.5 text-[11px] font-black transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
        style={{ color: "#be123c" }}
        aria-label="Sign out of Stratify"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          className="h-3.5 w-3.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 17l5-5-5-5" />
          <path d="M15 12H3" />
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
        </svg>

        <span className="hidden xl:inline">
          {loggingOut ? "Signing out" : "Logout"}
        </span>
      </button>
    </div>
  );
}
'@

Write-Utf8NoBom `
    -Path (Join-Path $ProjectRoot "app\login\page.tsx") `
    -Content $LoginPage

Write-Utf8NoBom `
    -Path (Join-Path $ProjectRoot "components\AuthNavButton.tsx") `
    -Content $AuthNavButton

Write-Host ""
Write-Host "Authentication UI polish applied successfully." -ForegroundColor Green
Write-Host "Updated:" -ForegroundColor Cyan
Write-Host "  app\login\page.tsx"
Write-Host "  components\AuthNavButton.tsx"
Write-Host ""
Write-Host "Run:" -ForegroundColor Yellow
Write-Host "  npm run build"
Write-Host "  npm run dev"
