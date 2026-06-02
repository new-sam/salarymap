import "@/styles/globals.css";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { I18nProvider, LanguageSwitcher, useT } from '../lib/i18n';
import { supabase } from '../lib/supabaseClient';
import MobileTabBar from '../components/MobileTabBar';

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
  // Admin pages use their own KO/EN toggle — hide the global footer switcher to avoid two competing controls
  const isAdmin = router.pathname.startsWith('/admin');
  return (
    <I18nProvider>
      <Component {...pageProps} />
      {!isAdmin && (
        <footer style={{
          background: '#0a0a09', borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '24px 40px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <LanguageSwitcher />
        </footer>
      )}
      <MobileTabBar />
      <GlobalLoginModal />
    </I18nProvider>
  );
}
