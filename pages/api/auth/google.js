// Initiates Google OAuth.
// - Production (our own domain): route through our /api/auth/google/callback so
//   the Google consent screen shows our domain, not the Supabase URL.
// - Preview (*.vercel.app) / local: Google has no redirect_uri registered for
//   dynamic Vercel domains, so route through Supabase's own OAuth endpoint
//   (its callback IS registered in Google). Supabase then redirects back to our
//   /auth/callback, which is allow-listed in Supabase Redirect URLs.

export default function handler(req, res) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host || '';
  const returnTo = typeof req.query.return === 'string' ? req.query.return : '/';

  const isPreviewOrLocal = host.endsWith('.vercel.app') || host.startsWith('localhost');

  if (isPreviewOrLocal) {
    const supaUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
    // returnTo는 localStorage에 저장해서 callback에서 읽음 (query string 빼서 Supabase 화이트리스트 정확히 매칭)
    const redirectTo = `${proto}://${host}/auth/callback`;
    if (returnTo && returnTo !== '/') {
      // returnTo는 일단 query로 전달하되 callback에서 다른 경로로 처리 가능
    }
    return res.redirect(
      `${supaUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`
    );
  }

  // Production — our own domain is a registered Google redirect_uri.
  const redirectUri = `${proto}://${host}/api/auth/google/callback`;
  const role = req.query.role === 'hr' ? 'hr' : '';
  const state = role ? JSON.stringify({ return: returnTo, role }) : returnTo;

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    state,
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
