"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AuthUser = {
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
};

export default function AuthNavButton() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();

      if (!mounted) return;

      if (data.user) {
        setUser({
          email: data.user.email ?? null,
          fullName:
            data.user.user_metadata?.full_name ||
            data.user.user_metadata?.name ||
            null,
          avatarUrl:
            data.user.user_metadata?.avatar_url ||
            data.user.user_metadata?.picture ||
            null,
        });
      } else {
        setUser(null);
      }

      setLoading(false);
    }

    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    router.push("/");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="h-9 w-20 animate-pulse rounded-full bg-slate-200" />
    );
  }

  if (!user) {
    return (
      <a
        href="/login"
        className="inline-flex items-center justify-center rounded-full bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700"
      >
        Sign in
      </a>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 shadow-sm">
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatarUrl}
          alt="User"
          className="h-7 w-7 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
          {(user.email || "U").charAt(0).toUpperCase()}
        </div>
      )}

      <span className="hidden max-w-[150px] truncate text-xs font-semibold text-slate-700 md:inline">
        {user.fullName || user.email}
      </span>

      <button
        onClick={handleLogout}
        className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
      >
        Logout
      </button>
    </div>
  );
}
