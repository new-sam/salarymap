import { useState, useEffect, useRef } from 'react';
import { Globe, Check } from 'lucide-react';
import { useT } from '../../lib/i18n';
import { cn } from '../../lib/cn';

const LANGS = [
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'en', label: 'English' },
  { code: 'ko', label: '한국어' },
];

export default function LangToggle({ align = 'right', tone = 'dark' }) {
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

  const triggerClass = tone === 'dark'
    ? 'border border-white/15 text-gray-300 hover:text-white hover:bg-white/5 hover:border-white/25'
    : 'border border-border text-gray-700 hover:text-foreground hover:bg-gray-100 hover:border-gray-300';

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          'inline-flex items-center gap-1 px-2 h-7 rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors',
          triggerClass
        )}
      >
        <Globe className="w-3 h-3" />
        {current.code}
      </button>
      {open && (
        <div
          className={cn(
            'absolute top-[calc(100%+4px)] z-[600] min-w-[160px] rounded-lg p-1 shadow-soft-lg',
            tone === 'dark'
              ? 'bg-[#141414] border border-white/10'
              : 'bg-card border border-border',
            align === 'left' ? 'left-0' : 'right-0'
          )}
        >
          {LANGS.map(l => {
            const active = lang === l.code;
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => { setLang(l.code); setOpen(false); }}
                className={cn(
                  'flex items-center gap-2 w-full px-2.5 py-2 rounded-md text-[13px] text-left transition-colors',
                  active
                    ? tone === 'dark'
                      ? 'bg-primary-500/15 text-primary-300 font-bold'
                      : 'bg-primary-50 text-primary-700 font-bold'
                    : tone === 'dark'
                      ? 'text-gray-300 hover:bg-white/5 hover:text-white font-medium'
                      : 'text-gray-700 hover:bg-gray-100 font-medium'
                )}
              >
                <span className="flex-1">{l.label}</span>
                {active && <Check className="w-3.5 h-3.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
