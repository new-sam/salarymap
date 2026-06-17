import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useT } from '../lib/i18n';
import { track } from '../lib/track';

// 웹 방문자에게 "FYI를 앱으로 만나보세요" 중앙 모달을 띄운다.
// 저장 안 함 — 하드 새로고침(마운트) 때만 한 번 뜬다. SPA 페이지 이동으로는 절대 안 뜸.
// /app(다운로드 페이지)·/admin 에서 새로고침한 경우엔 노출 안 함.
// App Store 링크. 지역/언어 강제 없이 방문자 스토어로 자동 분기되는 정규형 사용.
const APP_STORE_URL = 'https://apps.apple.com/app/id6778311550';

export default function AppDownloadModal() {
  const { t } = useT();
  const router = useRouter();
  const [show, setShow] = useState(false);

  // 마운트(=하드 새로고침) 시점에 딱 한 번만 판단. 빈 deps 의도적 — 페이지 이동 시 재실행 금지.
  useEffect(() => {
    const path = router.pathname;
    if (path.startsWith('/app') || path.startsWith('/admin')) return;
    const id = setTimeout(() => {
      setShow(true);
      track('view_app_promo_modal', { meta: { source: 'web_modal' }, page: path });
    }, 700);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismiss() {
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.78)', zIndex:1100, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', fontFamily:"'Barlow',sans-serif" }}
    >
      <style>{`
        @keyframes fyiSparkSpin { to { transform: rotate(360deg); } }
        @keyframes fyiSparkBreathe { 0%,100% { transform: scale(.9); } 50% { transform: scale(1.1); } }
        @keyframes fyiSparkTwinkle { 0%,100% { transform: scale(.25); opacity: .15; } 50% { transform: scale(1); opacity: 1; } }
        @keyframes fyiAiShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .fyi-ai-spark { flex: none; filter: drop-shadow(0 0 4px rgba(255,96,0,0.45)); }
        .fyi-ai-spark .spin { transform-box: fill-box; transform-origin: center; animation: fyiSparkSpin 7s linear infinite; }
        .fyi-ai-spark .main { transform-box: fill-box; transform-origin: center; animation: fyiSparkBreathe 2.6s ease-in-out infinite; }
        .fyi-ai-spark .mini { transform-box: fill-box; transform-origin: center; animation: fyiSparkTwinkle 2.6s ease-in-out infinite .35s; }
        .fyi-ai-title {
          background: linear-gradient(100deg, #ff9a4d 20%, #ffffff 42%, #ffd1a8 50%, #ff9a4d 70%);
          background-size: 200% 100%;
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent; color: transparent;
          animation: fyiAiShimmer 3.2s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .fyi-ai-spark .spin, .fyi-ai-spark .main, .fyi-ai-spark .mini, .fyi-ai-title { animation: none; }
          .fyi-ai-spark .mini { opacity: 1; transform: scale(1); }
          .fyi-ai-title { -webkit-text-fill-color: #ff9a4d; color: #ff9a4d; }
        }
      `}</style>
      <div style={{ position:'relative', background:'#1a1a18', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'20px', padding:'22px 22px 18px', maxWidth:'340px', width:'100%', textAlign:'center', boxShadow:'0 24px 60px rgba(0,0,0,0.5)' }}>
        <button
          onClick={dismiss}
          aria-label="close"
          style={{ position:'absolute', top:'14px', right:'16px', background:'none', border:'none', color:'rgba(255,255,255,0.35)', fontSize:'20px', lineHeight:1, cursor:'pointer' }}
        >×</button>

        <img src="/app-mockup.png" alt="FYI app" style={{ width:'108px', height:'auto', margin:'0 auto 12px', display:'block', filter:'drop-shadow(0 12px 28px rgba(0,0,0,0.45))' }} />

        <div style={{ fontSize:'19px', fontWeight:900, color:'#fff', letterSpacing:'-0.5px', marginBottom:'4px' }}>{t('appPromo.title')}</div>
        <div style={{ fontSize:'12.5px', color:'rgba(255,255,255,0.45)', marginBottom:'15px', lineHeight:1.45 }}>{t('appPromo.sub')}</div>

        <div style={{ display:'flex', flexDirection:'column', gap:'7px', textAlign:'left', marginBottom:'11px' }}>
          {['appPromo.benefit1','appPromo.benefit2','appPromo.benefit3'].map(k => (
            <div key={k} style={{ fontSize:'13px', color:'rgba(255,255,255,0.82)', fontWeight:600, lineHeight:1.35 }}>{t(k)}</div>
          ))}
        </div>

        <div style={{ textAlign:'left', background:'rgba(255,96,0,0.09)', border:'1px solid rgba(255,96,0,0.32)', borderRadius:'11px', padding:'10px 12px', marginBottom:'16px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'7px', marginBottom:'4px' }}>
            <span style={{ fontSize:'10px', fontWeight:900, color:'#0c0c0b', background:'#ff6000', borderRadius:'5px', padding:'2px 6px', letterSpacing:'0.5px' }}>NEW</span>
            <svg className="fyi-ai-spark" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <defs>
                <linearGradient id="fyiSparkG" x1="3" y1="3" x2="21" y2="21">
                  <stop offset="0" stopColor="#ffc59e" />
                  <stop offset="0.5" stopColor="#ff6000" />
                  <stop offset="1" stopColor="#c46bff" />
                </linearGradient>
              </defs>
              <g className="spin">
                <path className="main" d="M12 1.5c.55 5.2 4.8 9.45 10 10-5.2.55-9.45 4.8-10 10-.55-5.2-4.8-9.45-10-10 5.2-.55 9.45-4.8 10-10Z" fill="url(#fyiSparkG)" />
              </g>
              <g transform="translate(18.5 4.5)">
                <path className="mini" d="M0-3c.16 1.55 1.45 2.84 3 3-1.55.16-2.84 1.45-3 3-.16-1.55-1.45-2.84-3-3 1.55-.16 2.84-1.45 3-3Z" fill="#ffd9bd" />
              </g>
            </svg>
            <span className="fyi-ai-title" style={{ fontSize:'13.5px', fontWeight:800 }}>{t('appPromo.aiResumeTitle')}</span>
            <span style={{ fontSize:'10.5px', fontWeight:700, color:'rgba(255,255,255,0.4)', border:'1px solid rgba(255,255,255,0.18)', borderRadius:'5px', padding:'2px 6px', marginLeft:'auto' }}>{t('appPromo.appOnly')}</span>
          </div>
          <div style={{ fontSize:'12px', color:'rgba(255,255,255,0.7)', lineHeight:1.45 }}>{t('appPromo.aiResume')}</div>
        </div>

        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => { track('click_app_download', { meta: { source: 'web_modal' }, page: router.pathname }); dismiss(); }}
          style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'100%', background:'#ff6000', color:'#fff', fontSize:'14.5px', fontWeight:800, padding:'13px', borderRadius:'11px', textDecoration:'none', marginBottom:'8px' }}
        >{t('appPromo.cta')}</a>

        <button
          onClick={dismiss}
          style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', fontSize:'12.5px', cursor:'pointer', fontFamily:"'Barlow',sans-serif", width:'100%', padding:'4px' }}
        >{t('appPromo.later')}</button>
      </div>
    </div>
  );
}
