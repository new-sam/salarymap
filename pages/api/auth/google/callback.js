import { createClient } from '@supabase/supabase-js';
import supabaseAdmin from '../../../../lib/supabaseAdmin';
import { leadId } from '../../../../lib/ktcMailToken';

// Receives the auth code from Google, exchanges it for an ID token, then signs
// the user into Supabase via signInWithIdToken. Redirects to /auth/callback
// with the session tokens in the URL hash, where the existing client-side
// handler picks them up and stores the session.

// KTC CV 클레임 임포트 — 발송 스크립트가 sent 이벤트 meta 에 실어둔 cv_url(KTC 공개 스토리지,
// 해시 파일명이라 PII 아님)을 다운로드해 우리 'resumes' 버킷에 넣고 프로필에 건다.
// 공개 ON(is_resume_public)이 기본: 랜딩 버튼 문구가 "담당자에게 공개" 동의를 명시하고 있고,
// /cv 등록 흐름(hr_visible + share-resume set true)과 같은 상태로 맞춘다.
// 구조화 파싱(resume_summary)은 매일 도는 자동 파싱 크론이 이어받는다 — 콜백에서 LLM 호출은 과체중.
const KTC_CV_HOST = /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\//;
const CV_EXT = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
async function importKtcCv(u, meta, lead) {
  const cvUrl = String(meta.cv_url || '');
  if (!KTC_CV_HOST.test(cvUrl)) return;
  const r = await fetch(cvUrl);
  if (!r.ok) return;
  const buf = Buffer.from(await r.arrayBuffer());
  if (!buf.length || buf.length > 15 * 1024 * 1024) return;
  // 확장자는 URL 경로 기준, 이상하면 pdf — 파서가 시그니처로 재판별하므로(워드 .pdf 버그 대응 로직) 안전.
  const urlExt = (new URL(cvUrl).pathname.split('.').pop() || '').toLowerCase();
  const ext = CV_EXT[urlExt] ? urlExt : 'pdf';
  const path = `${u.id}.${ext}`;
  const { error: upErr } = await supabaseAdmin.storage.from('resumes')
    .upload(path, buf, { contentType: CV_EXT[ext], upsert: true });
  if (upErr) return;
  // 경로가 user id 고정이라 URL이 매번 같다 → 버전 쿼리로 CDN 캐시 우회(resume/upload 와 동일).
  const publicUrl = `${supabaseAdmin.storage.from('resumes').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
  // 사전 파싱(ktc_claim_profiles)이 있으면 구조화 필드까지 통째로 복사 — 가입 순간 프로필이
  // 완전체가 된다(랜딩이 보여준 카드 그대로). shape 은 parseResumeBuffer 의 update 와 동일해
  // user_profiles 컬럼에 그대로 얹힌다. 없으면(파싱 실패 리드) 매일 파싱 크론이 이어받는다.
  let parsedFields = {};
  try {
    const { data: claimProf } = await supabaseAdmin.from('ktc_claim_profiles')
      .select('summary').eq('email', (u.email || '').toLowerCase()).maybeSingle();
    if (claimProf?.summary) parsedFields = claimProf.summary;
  } catch {}
  const { error: profErr } = await supabaseAdmin.from('user_profiles').upsert({
    ...parsedFields,
    id: u.id,
    email: u.email,
    resume_url: publicUrl,
    resume_source: 'ktc_claim',
    resume_platform: 'web',
    is_resume_public: true,
    hr_visible: true,
    job_signal: 'open',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });
  if (profErr) return;
  await supabaseAdmin.from('events').insert([{
    event: 'ktc_cv_import',
    page: '/auth/callback',
    user_id: u.id,
    meta: { campaign: meta.campaign, lead },
  }]);
}

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
        // 최신 발송 우선(last-touch) — 재발송(revive) 수신자는 옛 발송 이벤트도 갖고 있어서,
        // 정렬 없이 [0]을 쓰면 가입이 옛 캠페인에 귀속된다.
        const { data: sentEv } = await supabaseAdmin.from('events')
          .select('meta').eq('event', 'coldmail_public_sent').eq('meta->>lead', lead)
          .order('created_at', { ascending: false }).limit(5);
        if (sentEv?.length) {
          await supabaseAdmin.from('events').insert([{
            event: 'coldmail_public_convert',
            page: '/auth/callback',
            meta: { campaign: sentEv[0].meta?.campaign || 'coldmail-ktc', lead, converted_user: u.id },
          }]);
          // CV 클레임 캠페인(coldmail-ktc-cv*): 발송 meta 에 실어둔 KTC 공개 스토리지 CV 를
          // 우리 스토리지로 옮겨 프로필에 등록한다 — 메일이 약속한 "프로필이 준비돼 있다"의 이행.
          // 실패해도 로그인은 막지 않는다(바깥 try). 프로필 행은 클라이언트(/auth/callback의
          // saveProfile)가 나중에 upsert 하므로 여기서도 upsert 로 선점한다(컬럼이 안 겹쳐 안전).
          const claim = sentEv.find(ev => /^coldmail-ktc-cv/.test(ev.meta?.campaign || '') && ev.meta?.cv_url);
          if (claim) await importKtcCv(u, claim.meta, lead);
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
