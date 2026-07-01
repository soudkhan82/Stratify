import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const origin = requestUrl.origin;

  if (code) {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const provider =
        data.user.app_metadata?.provider ||
        data.user.identities?.[0]?.provider ||
        'google';

      const forwardedFor = request.headers.get('x-forwarded-for');
      const ipAddress =
        forwardedFor?.split(',')?.[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        null;

      const userAgent = request.headers.get('user-agent') || null;

      await supabase.from('profiles').upsert({
        id: data.user.id,
        email: data.user.email,
        full_name:
          data.user.user_metadata?.full_name ||
          data.user.user_metadata?.name ||
          null,
        avatar_url: data.user.user_metadata?.avatar_url || null,
        provider,
        last_login_at: new Date().toISOString(),
      });

      await supabase.from('user_login_events').insert({
        user_id: data.user.id,
        email: data.user.email,
        provider,
        ip_address: ipAddress,
        user_agent: userAgent,
      });
    }
  }

  return NextResponse.redirect(`${origin}/`);
}

