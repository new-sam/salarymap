import { createClient } from '@supabase/supabase-js';
import supabaseAdmin from '../../../../lib/supabaseAdmin';
import { leadId } from '../../../../lib/ktcMailToken';

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

  // 신규 가입이면 sign_up 이벤트를 남긴다 — web/app split을 "첫 이벤트 platform" 역추정이
  // 아니라 가입 시점에서 직접 측정하기 위함. 이 콜백은 웹 OAuth 전용이라 platform='web'.
  // (앱은 자체 가입 성공 지점에서 platform:'app'으로 발화한다.) 실패해도 로그인은 막지 않는다.
  try {
    const u = data.user;
    const isNew = u?.created_at && (Date.now() - new Date(u.created_at).getTime() < 60_000);
    const isInternal = u?.email && u.email.endsWith('@likelion.net');
    if (isNew && !isInternal) {
      // sm_cid 쿠키(lib/track.js 가 심음) → 로그아웃 상태 단계와 가입을 잇는 client_id.
      const cid = req.cookies?.sm_cid || null;
      await supabaseAdmin.from('events').insert([{
        event: 'sign_up',
        page: '/auth/callback',
        user_id: u.id,
        client_id: cid,
        meta: { platform: 'web', provider: 'google' },
      }]);

      // 콜드메일(KTC 지원자) 수신자가 가입하면 전환으로 잇는다. 수신자는 계정이 없어 발송 시점에
      // user_id 가 없으므로 가입 이메일의 해시(leadId)로 발송 이벤트를 되찾는다 — 쿠키가 아니라
      // 이메일 기준이라 다른 기기/브라우저에서 가입해도 잡힌다.
      // user_id 는 비워둔다: 이 캠페인은 회원 대상 top-line 퍼널이 아니라 캠페인별 표에만 집계된다
      // (집계가 meta.lead 로 사람을 세므로, 조인용 계정 id 는 meta.converted_user 에 남긴다).
      const lead = u.email ? leadId(u.email) : null;
      if (lead) {
        const { data: sentEv } = await supabaseAdmin.from('events')
          .select('meta').eq('event', 'coldmail_public_sent').eq('meta->>lead', lead).limit(1);
        if (sentEv?.length) {
          await supabaseAdmin.from('events').insert([{
            event: 'coldmail_public_convert',
            page: '/auth/callback',
            meta: { campaign: sentEv[0].meta?.campaign || 'coldmail-ktc', lead, converted_user: u.id },
          }]);
        }
      }
    }
  } catch {}

  // Hand the session off to the existing client-side /auth/callback page via URL hash.
  const sess = data.session;
  const hash = new URLSearchParams({
    access_token: sess.access_token,
    refresh_token: sess.refresh_token,
    expires_in: String(sess.expires_in ?? 3600),
    token_type: 'bearer',
    provider_token: tokens.access_token || '',
  }).toString();

  // Parse state — may be a plain path or JSON with { return, role }
  let returnTo = '/';
  let role = '';
  if (typeof state === 'string') {
    if (state.startsWith('{')) {
      try {
        const parsed = JSON.parse(state);
        returnTo = parsed.return || '/';
        role = parsed.role || '';
      } catch { returnTo = '/'; }
    } else if (state.startsWith('/')) {
      returnTo = state;
    }
  }

  res.redirect(`/auth/callback?return=${encodeURIComponent(returnTo)}#${hash}`);
}
