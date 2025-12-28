// app/config/supabase-config.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return { url, anon };
}

/**
 * We DO NOT throw at module import time.
 * Next/Vercel may import this during prerender/build.
 *
 * Instead, we create the client lazily and throw only if someone actually
 * tries to access it without env vars configured.
 */
let _client: SupabaseClient | null = null;

function createSupabaseClient(): SupabaseClient {
  const { url, anon } = getEnv();

  if (!url || !anon) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Set these in Vercel Project Settings → Environment Variables."
    );
  }

  return createClient(url, anon);
}

/**
 * Default export is a Proxy so existing imports keep working:
 *   import supabase from "@/app/config/supabase-config";
 *
 * The proxy defers env validation until first actual usage.
 */
const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_client) _client = createSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return (_client as unknown as Record<PropertyKey, unknown>)[prop] as never;
  },
});

export default supabase;
