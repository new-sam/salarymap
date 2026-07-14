import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { track } from '../lib/track';
import { useFlags } from '../lib/flags';

// Google One Tap (2026-07-14~): 비로그인 방문자에게 구글 계정 원탭 가입 프롬프트.
// 기존 서버 플로우(/api/auth/google)와 동일하게 signInWithIdToken으로 Supabase 세션 생성 —
// 페이지 이동 없이 로그인되고, 각 페이지의 onAuthStateChange가 UI를 갱신한다.
// 전제: Google Cloud Console의 OAuth 클라이언트에 사이트 origin이 "Authorized JavaScript origins"로 등록돼 있어야 함.
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

function loadGsiScript() {
  return new Promise((resolve) => {
    if (window.google?.accounts?.id) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = resolve;
    s.onerror = resolve;
    document.head.appendChild(s);
  });
}

export default function GoogleOneTap() {
  const router = useRouter();
  const { flags, loaded: flagsLoaded } = useFlags(); // one_tap 플래그 확정 전엔 프롬프트 안 띄움
  // 자체 헤더/독립 랜딩 페이지는 제외 — 프롬프트가 레이아웃과 충돌하거나 전환 흐름(광고 랜딩)을 방해
  const excluded =
    router.pathname.startsWith('/admin') ||
    router.pathname.startsWith('/auth') ||
    router.pathname.startsWith('/company') ||
    router.pathname.startsWith('/promo') ||
    router.pathname === '/for-companies' ||
    router.pathname === '/c/[token]';

  useEffect(() => {
    if (excluded || !CLIENT_ID || !flagsLoaded || !flags.one_tap) return;
    let cancelled = false;

    const onCredential = async (response) => {
      try {
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: response.credential,
        });
        if (error || !data?.session) return;
        const u = data.user;
        const isNew = u?.created_at && Date.now() - new Date(u.created_at).getTime() < 60_000;

        // 프로필 upsert — index.js saveUserProfile과 동일 규칙(유저가 고친 이름은 안 덮음)
        try {
          const { data: existing } = await supabase
            .from('user_profiles').select('full_name').eq('id', u.id).maybeSingle();
          const payload = {
            id: u.id,
            email: u.email,
            avatar_url: u.user_metadata?.avatar_url || null,
            provider: 'google',
            updated_at: new Date().toISOString(),
          };
          if (!existing?.full_name) {
            payload.full_name = u.user_metadata?.full_name || u.user_metadata?.name || null;
          }
          await supabase.from('user_profiles').upsert(payload, { onConflict: 'id' });
        } catch {}

        // 익명 연봉 제출이 있으면 이 계정에 연결 (게이트 실험의 linked-rate 지표)
        try {
          const sid = localStorage.getItem('fyi_submission_id');
          if (sid) {
            fetch('/api/link-submission', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ submission_id: sid, user_id: u.id, email: u.email }),
            }).catch(() => {});
            localStorage.removeItem('fyi_submission_id');
          }
        } catch {}

        // 게이트 CTA를 눌렀다가 모달 대신 One Tap으로 로그인한 경우도 게이트 전환으로 귀속
        try {
          const gateSource = sessionStorage.getItem('fyi_gate_pending');
          if (gateSource) {
            sessionStorage.removeItem('fyi_gate_pending');
            track('company_gate_login_success', { meta: { source: gateSource, method: 'one_tap' }, page: router.pathname });
          }
        } catch {}

        track('one_tap_success', { meta: { new_user: !!isNew }, page: router.pathname });
        if (isNew && !(u.email || '').endsWith('@likelion.net')) {
          // 가입 시점 직접 계측 — 서버 OAuth 콜백의 sign_up과 동일 스키마 (One Tap은 그 콜백을 안 타므로 중복 없음)
          track('sign_up', { meta: { platform: 'web', provider: 'google', method: 'one_tap' }, page: router.pathname });
          if (typeof gtag === 'function') gtag('event', 'sign_up', { method: 'one_tap' });
          if (typeof fbq === 'function') fbq('trackCustom', 'SignupComplete', { intent: 'one_tap' });
        }
      } catch {}
    };

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled || session) return;
      await loadGsiScript();
      if (cancelled || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: onCredential,
        cancel_on_tap_outside: false,
        context: 'signin',
        use_fedcm_for_prompt: true,
      });
      window.google.accounts.id.prompt();
    })();

    return () => { cancelled = true; };
  }, [excluded, flagsLoaded, flags.one_tap]);

  return null;
}
