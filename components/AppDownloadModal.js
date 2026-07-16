import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useT } from '../lib/i18n';
import { track } from '../lib/track';

// 모바일 웹 방문자에게 "FYI를 앱으로" 하단 바텀시트를 밑에서 슬라이드업으로 띄운다.
// 메인페이지(/)에서, 모바일 뷰포트에서만, 하드 새로고침 시 한 번. SPA 이동으론 안 뜸.
// 닫으면(X/나중에) 이번 세션 동안은 다시 띄우지 않는다(sessionStorage) — 페이지마다 반복 노출 방지.
// App Store 링크. 지역/언어 강제 없이 방문자 스토어로 자동 분기되는 정규형 사용.
const APP_STORE_URL = 'https://apps.apple.com/app/id6778311550';
const DISMISS_KEY = 'fyi_app_promo_dismissed';

export default function AppDownloadModal() {
  const { t } = useT();
  const router = useRouter();
  const [show, setShow] = useState(false); // 마운트 여부
  const [open, setOpen] = useState(false); // 슬라이드 위치(true=올라옴)

  // 마운트(=하드 새로고침) 시점에 딱 한 번만 판단. 빈 deps 의도적 — 페이지 이동 시 재실행 금지.
  useEffect(() => {
    if (router.pathname !== '/') return;
    // 모바일 웹에서만 — 데스크톱은 iOS 앱 프로모가 의미 없어 띄우지 않는다.
    if (typeof window === 'undefined' || !window.matchMedia('(max-width: 768px)').matches) return;
    // 이번 세션에 이미 닫았으면 안 띄운다.
    try { if (sessionStorage.getItem(DISMISS_KEY)) return; } catch {}
    const id = setTimeout(() => {
      setShow(true);
      track('view_app_promo_modal', { meta: { source: 'web_modal' }, page: '/' });
    }, 700);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 마운트된 다음 프레임에 슬라이드업 시작.
  useEffect(() => {
    if (!show) return;
    const r = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(r);
  }, [show]);

  function dismiss() {
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch {}
    setOpen(false); // 슬라이드 다운
    setTimeout(() => setShow(false), 260); // 애니메이션 후 언마운트
  }

  if (!show) return null;

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) dismiss(); }}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', opacity: open ? 1 : 0, transition:'opacity .28s ease', zIndex:1100, display:'flex', alignItems:'flex-end', justifyContent:'center', fontFamily:"'Barlow',sans-serif" }}
    >
      <div style={{ position:'relative', overflow:'hidden', background:'#fff', borderRadius:'24px 24px 0 0', padding:'30px 26px calc(22px + env(safe-area-inset-bottom))', width:'100%', maxWidth:'480px', textAlign:'center', boxShadow:'0 -12px 40px rgba(0,0,0,0.22)', transform: open ? 'translateY(0)' : 'translateY(100%)', transition:'transform .32s cubic-bezier(.22,1,.36,1)' }}>
        {/* 상단 주황 글로우 — 앱 아이콘에서 브랜드 색이 은은히 퍼지는 배경 */}
        <div style={{ position:'absolute', top:'-90px', left:'50%', transform:'translateX(-50%)', width:'280px', height:'200px', background:'radial-gradient(ellipse at center, rgba(255,96,0,0.16), rgba(255,96,0,0) 70%)', pointerEvents:'none' }} />

        <button
          onClick={dismiss}
          aria-label="close"
          style={{ position:'absolute', top:'15px', right:'16px', background:'none', border:'none', color:'#c4c4c4', fontSize:'22px', lineHeight:1, cursor:'pointer', zIndex:1 }}
        >×</button>

        <div style={{ position:'relative' }}>
          <img
            src="/apple-touch-icon.png"
            alt="FYI"
            style={{ width:'64px', height:'64px', borderRadius:'15px', display:'block', margin:'0 auto 18px', boxShadow:'0 8px 20px rgba(0,0,0,0.18)' }}
          />

          <div style={{ fontSize:'19px', fontWeight:800, color:'#111', letterSpacing:'-0.4px', lineHeight:1.35, marginBottom:'6px' }}>{t('appPromo.title')}</div>
          <div style={{ fontSize:'14px', color:'#8a8a8a', lineHeight:1.5, marginBottom:'22px' }}>{t('appPromo.sub')}</div>

          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => { track('click_app_download', { meta: { source: 'web_modal' }, page: router.pathname }); dismiss(); }}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'100%', background:'#ff6000', color:'#fff', fontSize:'15.5px', fontWeight:800, padding:'15px', borderRadius:'100px', textDecoration:'none', boxShadow:'0 8px 20px rgba(255,96,0,0.32)' }}
          >{t('appPromo.cta')}</a>

          <button
            onClick={dismiss}
            style={{ background:'none', border:'none', color:'#b0b0b0', fontSize:'13px', cursor:'pointer', fontFamily:"'Barlow',sans-serif", width:'100%', padding:'14px 4px 2px' }}
          >{t('appPromo.later')}</button>
        </div>
      </div>
    </div>
  );
}
