'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '');

  async function signInWithGoogle() {
    setLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${siteUrl}/auth/callback`,
      },
    });

    if (error) {
      alert(error.message);
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#020617] px-4">
      <div className="w-full max-w-md rounded-3xl border border-emerald-500/20 bg-slate-950 p-8 shadow-2xl">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-2xl">
            🌍
          </div>

          <h1 className="text-3xl font-bold text-white">
            Welcome to Stratify
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-400">
            Sign in securely to access dashboards and track user activity.
          </p>
        </div>

        <button
          onClick={signInWithGoogle}
          disabled={loading}
          className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="text-lg font-bold">G</span>
          {loading ? 'Redirecting...' : 'Continue with Google'}
        </button>

        <p className="mt-6 text-center text-xs text-slate-500">
          Access is secured through Supabase Authentication.
        </p>
      </div>
    </main>
  );
}
