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

      const secureCookie =
        window.location.protocol === "https:" ? "; Secure" : "";

      document.cookie = `stratify_auth_next=${encodeURIComponent(
        nextPath,
      )}; Path=/; Max-Age=600; SameSite=Lax${secureCookie}`;

      const callbackUrl = new URL(
        "/auth/callback",
        window.location.origin,
      ).toString();

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl,
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
              ÃƒÂ¢Ã…â€œÃ¢â‚¬Å“
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