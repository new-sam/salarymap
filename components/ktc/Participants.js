import { useState } from 'react';
import { useT } from '../../lib/i18n';
import Reveal from './Reveal';
import { ANCHOR, BRAND, c, s } from './ktcStyles';

/* 반응형으로 두 가지 형태를 쓴다.
   - 모바일: 탭 하나만 노출(기본 '공통'). 원본처럼 전부 세로로 쌓으면 너무 길어진다.
   - 데스크톱(≥900px): 탭바를 숨기고 Non-IT/IT 를 2단으로 전개. 공통 카드는
     감춘다 — 길이 압박이 없는 화면에서는 대상 구분만 보여주기로 했다.
   전환은 pages/ktc/index.js 의 .ktc-part-* 미디어쿼리가 inline display 를
   !important 로 덮어쓰는 방식 — 카드를 두 벌 렌더하지 않는다.
   fg 는 탭 선택 시 글자색 — 공통 액센트가 밝은 색이라 따로 둔다. */
const TABS = [
  {
    key: 'common',
    accent: '#4E5968',
    fg: '#fff',
    count: 3,
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12l2 2 4-4" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
  {
    key: 'nonit',
    accent: '#5B9DFF',
    fg: '#fff',
    count: 4,
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    key: 'it',
    accent: BRAND,
    fg: '#fff',
    count: 4,
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
];

function Check({ color }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 3 }}>
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function Card({ tab, visible }) {
  const { t } = useT();
  return (
    <div
      className={`ktc-part-card${tab.key === 'common' ? ' ktc-part-card-common' : ''}`}
      style={{ ...s.card, display: visible ? 'block' : 'none' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            display: 'grid',
            placeItems: 'center',
            background: `${tab.accent}1f`,
            color: tab.accent,
            flexShrink: 0,
          }}
        >
          {tab.icon}
        </span>
        {/* 데스크톱에서만 — 모바일은 탭바가 같은 라벨을 이미 보여준다 */}
        <span
          className="ktc-part-badge"
          style={{
            padding: '5px 12px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '0.04em',
            background: `${tab.accent}1f`,
            color: tab.accent,
            border: `1px solid ${tab.accent}40`,
          }}
        >
          {t(`ktc.part.${tab.key}.badge`)}
        </span>
      </div>

      <ul style={{ display: 'grid', gap: 16, listStyle: 'none' }}>
        {Array.from({ length: tab.count }, (_, i) => i + 1).map((n) => (
          <li key={n} style={{ display: 'flex', gap: 11 }}>
            <Check color={tab.accent} />
            <div>
              <p style={{ fontSize: 14.5, fontWeight: 700, color: c.text }}>{t(`ktc.part.${tab.key}.${n}.title`)}</p>
              <p style={{ marginTop: 4, fontSize: 13.5, lineHeight: 1.65, color: c.textDim }}>
                {t(`ktc.part.${tab.key}.${n}.desc`)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Participants() {
  const { t } = useT();
  const [active, setActive] = useState('common');

  return (
    <section id={ANCHOR.who} className="ktc-anchor" style={s.section}>
      <div style={s.container}>
        <Reveal>
          <h2 style={s.h2}>{t('ktc.part.title')}</h2>
          <p style={s.sub}>{t('ktc.part.sub')}</p>
        </Reveal>

        <Reveal>
          <div className="ktc-part-wrap">
            {/* 탭바 — 모바일 전용. JobBoard 필터와 같은 세그먼트 컨트롤 형태. */}
            <div
              className="ktc-part-tabs"
              style={{
                display: 'flex',
                gap: 4,
                padding: 4,
                margin: 'clamp(28px, 4vw, 44px) auto 0',
                width: 'fit-content',
                maxWidth: '100%',
                borderRadius: 10,
                background: c.surface,
                border: `1px solid ${c.line}`,
              }}
            >
              {TABS.map((x) => (
                <button
                  key={x.key}
                  onClick={() => setActive(x.key)}
                  aria-pressed={active === x.key}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 7,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13.5,
                    fontWeight: 750,
                    whiteSpace: 'nowrap',
                    background: active === x.key ? x.accent : 'transparent',
                    color: active === x.key ? x.fg : c.textDim,
                    transition: 'background .15s, color .15s',
                  }}
                >
                  {t(`ktc.part.${x.key}.badge`)}
                </button>
              ))}
            </div>

            <div className="ktc-part-grid">
              {TABS.map((x) => (
                <Card key={x.key} tab={x} visible={active === x.key} />
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
