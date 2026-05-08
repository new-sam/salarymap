// Initiates Google OAuth from our own domain (instead of routing through
// Supabase's domain). Redirects the browser to Google's auth page so the
// "Continue to <site>" prompt shows our domain, not the Supabase URL.

export default function handler(req, res) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  const redirectUri = `${proto}://${host}/api/auth/google/callback`;

  const state = typeof req.query.return === 'string' ? req.query.return : '/';

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
