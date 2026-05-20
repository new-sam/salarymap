import { useState, useEffect, useRef } from 'react';
import { useT } from '../../lib/i18n';

// 회사 화면(라이트 테마)용 언어 토글
const LANGS = [
  { code: 'vi', flag: '🇻🇳', label: 'Tiếng Việt' },
  { code: 'en', flag: '🇺🇸', label: 'English' },
  { code: 'ko', flag: '🇰🇷', label: '한국어' },
];

export default function LangToggle({ align = 'right' }) {
  const { lang, setLang } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = LANGS.find(l => l.code === lang) || LANGS[0];

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: '#fff', border: '1px solid #E5E7EB',
          borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
          fontSize: 12, color: '#525252', fontFamily: 'inherit',
        }}
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>{current.flag}</span>
        <span style={{ fontWeight: 700 }}>{current.code.toUpperCase()}</span>
        <span style={{ fontSize: 9, color: '#9CA3AF' }}>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)',
          ...(align === 'left' ? { left: 0 } : { right: 0 }),
          zIndex: 600, background: '#fff', border: '1px solid #E5E7EB',
          borderRadius: 10, padding: 4, minWidth: 160,
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
        }}>
          {LANGS.map(l => (
            <button
              key={l.code}
              onClick={() => { setLang(l.code); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '8px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
                background: lang === l.code ? '#FFF7ED' : 'transparent',
                color: lang === l.code ? '#EA580C' : '#525252',
                fontSize: 13, fontWeight: lang === l.code ? 700 : 500,
                fontFamily: 'inherit', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>{l.flag}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
