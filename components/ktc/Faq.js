import { useState } from 'react';
import { useT } from '../../lib/i18n';
import Reveal from './Reveal';
import { ANCHOR, BRAND, c, s } from './ktcStyles';

const QUESTIONS = [1, 2, 3, 4, 5];

function Item({ n, open, onToggle }) {
  const { t } = useT();
  return (
    <div
      style={{
        borderRadius: 14,
        border: `1px solid ${open ? 'rgba(255,96,0,0.32)' : c.line}`,
        background: open ? 'rgba(255,96,0,0.06)' : c.surface,
        overflow: 'hidden',
        transition: 'background .2s, border-color .2s',
      }}
    >
      <button
        onClick={onToggle}
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          width: '100%',
          padding: '19px 22px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          color: c.text,
          fontSize: 15,
          fontWeight: 700,
          lineHeight: 1.5,
        }}
      >
        {t(`ktc.faq.${n}.q`)}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke={open ? BRAND : c.textFaint}
          strokeWidth="2"
          strokeLinecap="round"
          style={{ flexShrink: 0 }}
        >
          <path d="M4 12h16" />
          {!open && <path d="M12 4v16" />}
        </svg>
      </button>
      <div
        style={{
          display: 'grid',
          gridTemplateRows: open ? '1fr' : '0fr',
          transition: 'grid-template-rows .28s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <p style={{ padding: '0 22px 20px', fontSize: 14, lineHeight: 1.75, color: c.textDim }}>
            {t(`ktc.faq.${n}.a`)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Faq() {
  const { t } = useT();
  const [openN, setOpenN] = useState(null);

  return (
    <section id={ANCHOR.faq} className="ktc-anchor" style={s.sectionAlt}>
      <div style={s.container}>
        <Reveal>
          <h2 style={s.h2} dangerouslySetInnerHTML={{ __html: t('ktc.faq.title') }} />
        </Reveal>

        <div style={{ marginTop: 'clamp(30px, 5vw, 52px)', maxWidth: 740, margin: 'clamp(30px, 5vw, 52px) auto 0', display: 'grid', gap: 10 }}>
          {QUESTIONS.map((n, i) => (
            <Reveal key={n} delay={i * 50}>
              <Item n={n} open={openN === n} onToggle={() => setOpenN(openN === n ? null : n)} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
