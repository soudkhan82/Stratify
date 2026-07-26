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
      router.replace("/");
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
        href="/#sign-in"
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