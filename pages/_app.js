import "@/styles/globals.css";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Toaster } from 'sonner';
import { I18nProvider, LanguageSwitcher, useT } from '../lib/i18n';
import { supabase } from '../lib/supabaseClient';
import MobileTabBar from '../components/MobileTabBar';
import AppDownloadModal from '../components/AppDownloadModal';
import GlobalNav from '../components/GlobalNav';
import GoogleOneTap from '../components/GoogleOneTap';
import { track } from '../lib/track';

/* pathname → GlobalNav activePage key. The set determines whether GlobalNav
   renders at all (company/admin/standalone pages have their own headers). */
function activePageFor(pathname) {
  if (pathname === '/') return 'home';
  if (pathname === '/cv') return 'cv';
  if (pathname === '/jobs' || pathname === '/jobs/[id]') return 'jobs';
  if (pathname.startsWith('/community') || pathname.startsWith('/companies/')) return 'community';
  if (pathname === '/my-applications') return 'my-applications';
  if (pathname === '/saved-jobs') return 'saved-jobs';
  if (pathname === '/profile') return 'profile';
  return null;
}

function GlobalFooter() {
  const { t } = useT();
  return (
    <footer style={{
      background: '#0a0a09', borderTop: '1px solid rgba(255,255,255,0.06)',
      padding: '24px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap',
    }}>
      <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'rgba(242,240,235,0.42)' }}>
        {t('footer.copyright')}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <LanguageSwitcher />
        <a href="/app" style={{ fontSize: 13, color: '#ff6000', textDecoration: 'none', fontWeight: 600 }}>📱 {t('footer.downloadApp')}</a>
        <a href="/how-it-works" style={{ fontSize: 13, color: 'rgba(242,240,235,0.42)', textDecoration: 'none' }}>{t('footer.howItWorks')}</a>
        <a href="/privacy" style={{ fontSize: 13, color: 'rgba(242,240,235,0.42)', textDecoration: 'none' }}>{t('footer.privacy')}</a>
        <a href="/terms" style={{ fontSize: 13, color: 'rgba(242,240,235,0.42)', textDecoration: 'none' }}>{t('footer.terms')}</a>
      </div>
    </footer>
  );
}

function GlobalLoginModal() {
  const { t } = useT();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = () => setShow(true);
    window.addEventListener('fyi-show-login', handler);
    return () => window.removeEventListener('fyi-show-login', handler);
  }, []);

  if (!show) return null;
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}
      onClick={e => { if(e.target===e.currentTarget) setShow(false) }}>
      <div style={{background:'#1a1a18',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'20px',padding:'40px 36px',maxWidth:'420px',width:'100%',fontFamily:"'Barlow',sans-serif"}}>
        <div style={{fontSize:'24px',fontWeight:900,color:'#fff',letterSpacing:'-0.5px',marginBottom:'8px'}}>{t('auth.title')}</div>
        <div style={{fontSize:'13px',color:'rgba(255,255,255,0.4)',marginBottom:'28px',lineHeight:1.6}}>{t('auth.sub')}</div>
        <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
          <button onClick={() => { setShow(false); localStorage.setItem('fyi_login_return', window.location.pathname + window.location.search); supabase.auth.signInWithOAuth({ provider:'linkedin_oidc', options:{ redirectTo: window.location.origin+'/auth/callback', scopes:'openid profile email' } }) }}
            style={{width:'100%',background:'#0A66C2',color:'#fff',fontSize:'14px',fontWeight:700,padding:'14px',borderRadius:'10px',border:'none',cursor:'pointer',fontFamily:"'Barlow',sans-serif",display:'flex',alignItems:'center',justifyContent:'center',gap:'10px'}}>
            <span style={{fontWeight:900,fontSize:'16px'}}>in</span> {t('auth.linkedin')}
          </button>
          <button onClick={() => { setShow(false); window.location.href = '/api/auth/google?return=' + encodeURIComponent(window.location.pathname + window.location.search) }}
            style={{width:'100%',background:'#fafaf8',color:'#111',fontSize:'14px',fontWeight:700,padding:'14px',borderRadius:'10px',border:'none',cursor:'pointer',fontFamily:"'Barlow',sans-serif",display:'flex',alignItems:'center',justifyContent:'center',gap:'10px'}}>
            <span style={{fontWeight:900,fontSize:'16px'}}>G</span> {t('auth.google')}
          </button>
          <button onClick={() => setShow(false)}
            style={{background:'none',border:'none',color:'rgba(255,255,255,0.3)',fontSize:'12px',cursor:'pointer',fontFamily:"'Barlow',sans-serif",marginTop:'4px',width:'100%',textAlign:'center'}}>
            {t('auth.later')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App({ Component, pageProps }) {
  const router = useRouter();
  // Company pages have their own language switcher; admin pages also have their own.
  const isCompany = router.pathname.startsWith('/company') || router.pathname === '/for-companies';
  const isAdmin = router.pathname.startsWith('/admin');
  // Job detail renders its own bottom Apply/Save CTA, so it hides the global
  // MobileTabBar (which would otherwise cover the CTA at bottom:0).
  const isJobDetail = router.pathname === '/jobs/[id]';
  // 공개 디지털 명함(/c/[token])은 공유 링크용 독립 페이지 — 앱 소개 모달/탭바/푸터 없이 깔끔하게.
  const isCard = router.pathname === '/c/[token]';
  // /for-companies 는 공개 랜딩이라 하단 글로벌 언어 스위처를 메인 랜딩과 동일하게 노출한다.
  const isForCompaniesLanding = router.pathname === '/for-companies';
  // Ad-landing routes get a static nav. /promo 는 푸터까지 차단(exit leak),
  // /cv 는 푸터에 언어 스위처가 필요해 노출한다.
  const isAdLanding = router.pathname === '/cv' || router.pathname.startsWith('/promo');
  const isPromoLanding = router.pathname.startsWith('/promo');

  // Flag the body so the mobile-only top/bottom reservations (52/60px in
  // globals.css) collapse for company pages — they render their own header.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (isCompany) document.body.dataset.companyMobile = '1';
    else delete document.body.dataset.companyMobile;
    if (isJobDetail) document.body.dataset.jobDetailMobile = '1';
    else delete document.body.dataset.jobDetailMobile;
    // Ad-landing routes (/cv, /promo/*) get a static nav (not sticky)
    if (isAdLanding) document.body.dataset.adLanding = '1';
    else delete document.body.dataset.adLanding;
    if (isCard) document.body.dataset.cardMobile = '1';
    else delete document.body.dataset.cardMobile;
    // Admin pages render their own header and no MobileTabBar, so reset the
    // global top/bottom mobile reservations.
    if (isAdmin) document.body.dataset.adminMobile = '1';
    else delete document.body.dataset.adminMobile;
  }, [isCompany, isJobDetail, isAdLanding, isCard, isAdmin]);
  const activePage = activePageFor(router.pathname);

  // 웹 첫 진입(세션당 1회) — landing 은 홈에서만 떠서 공고/CV/회사 링크 등 직접 유입을 놓친다.
  // 어떤 페이지로 들어왔든 세션 진입을 잡아 '진입→가입' 퍼널의 시작점을 만든다. UTM/referrer 도 귀속.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (router.pathname.startsWith('/admin')) return; // 내부 어드민 뷰 제외
    try {
      if (sessionStorage.getItem('sm_session_started')) return;
      sessionStorage.setItem('sm_session_started', '1');
    } catch { return; } // sessionStorage 불가(프라이빗 모드 등) → 라우트마다 폭증 방지 위해 스킵
    const p = new URLSearchParams(window.location.search);
    track('session_start', {
      page: window.location.pathname,
      meta: {
        entry_path: window.location.pathname,
        referrer: document.referrer || null,
        utm_source: p.get('utm_source'),
        utm_medium: p.get('utm_medium'),
        utm_campaign: p.get('utm_campaign'),
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 모바일: 스크롤 다운하면 헤더·하단탭바를 숨겨 가용 화면을 넓히고, 스크롤 업/최상단이면
  // 다시 띄운다. 콘텐츠 페이지 + /cv(헤더는 static이라 스크롤로 사라지지만 하단 탭바는 남아
  // 같이 숨겨야 함) — 명함·기업·어드민·공고상세는 제외. /promo는 activePage 없어 자동 제외.
  const autoHideChrome = !!activePage && !isCard && !isCompany && !isAdmin && !isJobDetail;
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const body = document.body;
    if (!autoHideChrome) { delete body.dataset.chromeHidden; return; }
    let lastY = window.scrollY;
    let ticking = false;
    const THRESH = 8; // 미세 스크롤 떨림 무시
    const update = () => {
      ticking = false;
      const y = window.scrollY;
      if (y < 60) { delete body.dataset.chromeHidden; lastY = y; return; } // 최상단 근처는 항상 노출
      const dy = y - lastY;
      if (dy > THRESH) { body.dataset.chromeHidden = '1'; lastY = y; }
      else if (dy < -THRESH) { delete body.dataset.chromeHidden; lastY = y; }
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); delete body.dataset.chromeHidden; };
  }, [autoHideChrome, router.pathname]);
  return (
    <I18nProvider>
      {/* 콘텐츠가 짧은 페이지/탭에서 푸터가 위로 따라 올라오지 않도록:
          최소 뷰포트 높이를 채우고 푸터는 항상 바닥에 붙인다. */}
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {activePage && (
          <GlobalNav
            activePage={activePage}
            onLogin={() => {
              if (typeof window === 'undefined') return;
              if (typeof window.openAuthModal === 'function') window.openAuthModal();
              else window.dispatchEvent(new Event('fyi-show-login'));
            }}
            onJobsClick={() => {
              if (router.pathname !== '/') return;
              fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: 'click_jobs_cta', page: 'home' }) }).catch(() => {});
            }}
          />
        )}
        <main style={{ flex: '1 0 auto' }}>
          <Component {...pageProps} />
        </main>
        {(!isCompany || isForCompaniesLanding) && !isAdmin && !isPromoLanding && !isCard && (
          <GlobalFooter />
        )}
      </div>
      {!isCompany && !isJobDetail && !isCard && !isAdmin && <MobileTabBar />}
      <GlobalLoginModal />
      <GoogleOneTap />
      {!isAdmin && !isAdLanding && !isCard && !isCompany && <AppDownloadModal />}
      <Toaster
        position="bottom-right"
        richColors
        closeButton
        toastOptions={{
          style: { fontFamily: "'Pretendard', sans-serif", fontWeight: 600 },
        }}
      />
    </I18nProvider>
  );
}
