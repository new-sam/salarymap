import "@/styles/globals.css";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Toaster } from 'sonner';
import { I18nProvider, LanguageSwitcher, useT } from '../lib/i18n';
import { supabase } from '../lib/supabaseClient';
import MobileTabBar from '../components/MobileTabBar';
import AppDownloadModal from '../components/AppDownloadModal';

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
          <button onClick={() => { setShow(false); supabase.auth.signInWithOAuth({ provider:'linkedin_oidc', options:{ redirectTo: window.location.origin+'/auth/callback', scopes:'openid profile email' } }) }}
            style={{width:'100%',background:'#0A66C2',color:'#fff',fontSize:'14px',fontWeight:700,padding:'14px',borderRadius:'10px',border:'none',cursor:'pointer',fontFamily:"'Barlow',sans-serif",display:'flex',alignItems:'center',justifyContent:'center',gap:'10px'}}>
            <span style={{fontWeight:900,fontSize:'16px'}}>in</span> {t('auth.linkedin')}
          </button>
          <button onClick={() => { setShow(false); window.location.href = '/api/auth/google?return=' + encodeURIComponent(window.location.pathname) }}
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
  // /for-companies 는 공개 랜딩이라 하단 글로벌 언어 스위처를 메인 랜딩과 동일하게 노출한다.
  const isForCompaniesLanding = router.pathname === '/for-companies';
  // /cv 는 광고 랜딩이라 하단 탭바·언어 스위처를 노출하지 않는다 (exit leak 차단).
  const isAdLanding = router.pathname === '/cv';

  // Flag the body so the mobile-only top/bottom reservations (52/60px in
  // globals.css) collapse for company pages — they render their own header.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (isCompany) document.body.dataset.companyMobile = '1';
    else delete document.body.dataset.companyMobile;
    if (isJobDetail) document.body.dataset.jobDetailMobile = '1';
    else delete document.body.dataset.jobDetailMobile;
  }, [isCompany, isJobDetail]);
  return (
    <I18nProvider>
      <Component {...pageProps} />
      {(!isCompany || isForCompaniesLanding) && !isAdmin && !isAdLanding && (
        <footer style={{
          background: '#0a0a09', borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '24px 40px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <LanguageSwitcher />
        </footer>
      )}
      {!isCompany && !isJobDetail && !isAdLanding && <MobileTabBar />}
      <GlobalLoginModal />
      {!isAdmin && <AppDownloadModal />}
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
