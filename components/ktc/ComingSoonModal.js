import { useEffect, useState } from 'react';
import { useT } from '../../lib/i18n';
import { APPLY_SOON_EVENT, BRAND, c, s } from './ktcStyles';

/* 지원 접수가 아직 열리지 않아, 모든 "지원하기" CTA 가 이 안내로 모인다.
   페이지에 한 번만 마운트하고, CTA 들은 openApplySoon() 으로 이벤트만 쏜다
   — 히어로·섹션 탭바·공고 카드가 서로 상태를 주고받지 않아도 된다. */
export default function ComingSoonModal() {
  const { t } = useT();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(APPLY_SOON_EVENT, show);
    return () => window.removeEventListener(APPLY_SOON_EVENT, show);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => setOpen(false)}
      style={{ position: 'fixed', inset: 0, zIndex: 700, display: 'grid', placeItems: 'center', padding: 20 }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(17,24,39,0.42)', backdropFilter: 'blur(2px)' }} />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 380,
          padding: '30px 26px 24px',
          borderRadius: 18,
          background: c.bgAlt,
          border: `1px solid ${c.line}`,
          boxShadow: '0 24px 64px rgba(17,24,39,0.22)',
          textAlign: 'center',
        }}
      >
        <span
          style={{
            width: 46,
            height: 46,
            margin: '0 auto',
            borderRadius: 999,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(255,96,0,0.12)',
            color: BRAND,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </span>

        <h3 style={{ marginTop: 16, fontSize: 17.5, fontWeight: 800, color: c.text, letterSpacing: '-0.01em' }}>
          {t('ktc.jobs.soonTitle')}
        </h3>
        <p
          style={{ marginTop: 10, fontSize: 14, lineHeight: 1.65, color: c.textDim }}
          dangerouslySetInnerHTML={{ __html: t('ktc.jobs.soonDesc') }}
        />

        <button onClick={() => setOpen(false)} style={{ ...s.btnPrimary, width: '100%', marginTop: 22 }}>
          {t('ktc.jobs.soonClose')}
        </button>
      </div>
    </div>
  );
}
