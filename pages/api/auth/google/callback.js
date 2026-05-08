import { createClient } from '@supabase/supabase-js';

// Receives the auth code from Google, exchanges it for an ID token, then signs
// the user into Supabase via signInWithIdToken. Redirects to /auth/callback
// with the session tokens in the URL hash, where the existing client-side
// handler picks them up and stores the session.

export default async function handler(req, res) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  const baseUrl = `${proto}://${host}`;

  const { code, state, error: googleErr } = req.query;
  if (googleErr) return res.redirect(`/?login_error=${encodeURIComponent(googleErr)}`);
  if (!code) return res.redirect('/?login_error=no_code');

  // Exchange code for tokens with Google
  let tokens;
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${baseUrl}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    tokens = await tokenRes.json();
  } catch (e) {
    return res.redirect('/?login_error=token_exchange_failed');
  }

  if (!tokens?.id_token) {
    return res.redirect(`/?login_error=${encodeURIComponent(tokens?.error || 'no_id_token')}`);
  }

  // Sign into Supabase with the Google ID token
  const supabase = createClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim(),
  );

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: tokens.id_token,
  });

  if (error || !data?.session) {
    return res.redirect(`/?login_error=${encodeURIComponent(error?.message || 'supabase_signin_failed')}`);
  }

  // Hand the session off to the existing client-side /auth/callback page via URL hash.
  const sess = data.session;
  const hash = new URLSearchParams({
    access_token: sess.access_token,
    refresh_token: sess.refresh_token,
    expires_in: String(sess.expires_in ?? 3600),
    token_type: 'bearer',
    provider_token: tokens.access_token || '',
  }).toString();

  const returnTo = typeof state === 'string' && state.startsWith('/') ? state : '/';
  res.redirect(`/auth/callback?return=${encodeURIComponent(returnTo)}#${hash}`);
}
