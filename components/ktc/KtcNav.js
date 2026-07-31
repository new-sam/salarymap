import { useEffect, useRef, useState } from 'react';
import { useT } from '../../lib/i18n';
import { ANCHOR, BRAND, c, s, scrollTo } from './ktcStyles';
import { setVia } from './ktcTrack';

/* 섹션 탭바 — FYI GlobalNav 바로 아래에 붙는 섹션 이동 전용 바(로고·로그인 등 헤더
   역할은 GlobalNav 가 담당). 히어로 CTA 가 화면을 벗어나면 등장해서, 페이지가 길어져
   현재 위치를 잃기 쉬운 구간에서만 내비를 띄운다.
   sticky top 값은 GlobalNav 높이(데스크톱 56 / 모바일 52)와 맞춰야 하며
   pages/ktc/index.js 의 .ktc-sectiontabs 가 관리한다. */
const SECTIONS = [
  { anchor: ANCHOR.about, label: 'ktc.nav.about' },
  { anchor: ANCHOR.who, label: 'ktc.nav.who' },
  { anchor: ANCHOR.jobs, label: 'ktc.nav.jobs' },
  { anchor: ANCHOR.benefit, label: 'ktc.nav.benefit' },
  { anchor: ANCHOR.faq, label: 'ktc.nav.faq' },
];

export default function KtcNav() {
  const { t } = useT();
  const [activeSection, setActiveSection] = useState(null);
  const tabsRef = useRef(null);
  const barRef = useRef(null);

  /* 스크롤스파이 — "기준선을 이미 지나온 섹션 중 마지막"을 활성으로 본다.
     IntersectionObserver 는 상태가 바뀐 섹션만 콜백에 담아주기 때문에, 탭에 없는
     섹션(주관 기관·차별점·여정 등)을 지날 때 갱신이 끊긴다. 스크롤 위치로 직접
     계산하면 그런 상태 의존이 없어진다. 기준선은 탭바가 실제로 걸리는 위치. */
  useEffect(() => {
    let raf = 0;
    const pick = () => {
      raf = 0;
      const bar = barRef.current;
      const line = window.scrollY + (bar ? bar.getBoundingClientRect().bottom : 100) + 8;
      let current = null;
      for (const x of SECTIONS) {
        const el = document.getElementById(x.anchor);
        if (!el) continue;
        if (el.getBoundingClientRect().top + window.scrollY <= line) current = x.anchor;
      }
      setActiveSection(current);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(pick); };
    pick();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  /* 활성 탭이 가로 스크롤 밖에 있으면 보이도록 끌어온다(모바일). */
  useEffect(() => {
    if (!activeSection || !tabsRef.current) return;
    const btn = tabsRef.current.querySelector(`[data-section="${activeSection}"]`);
    btn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeSection]);

  return (
    <div
      ref={barRef}
      className="ktc-sectiontabs"
      style={{
        // 아래 섹션(AboutUs = sectionAlt 흰색)과 같은 배경 — 히어로(#f9f9f9)와는 구분된다
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${c.line}`,
      }}
    >
      <div
        ref={tabsRef}
        className="ktc-tabs-row"
        style={{
          ...s.container,
          display: 'flex',
          alignItems: 'stretch',
          gap: 4,
          overflowX: 'auto',
          overflowY: 'hidden',
        }}
      >
        {SECTIONS.map((x) => {
          const on = activeSection === x.anchor;
          return (
            <button
              key={x.anchor}
              data-section={x.anchor}
              onClick={() => { if (x.anchor === ANCHOR.jobs) setVia('nav'); scrollTo(x.anchor); }}
              aria-current={on ? 'true' : undefined}
              style={{
                flexShrink: 0,
                padding: '0 14px',
                background: 'none',
                border: 'none',
                borderBottom: `2px solid ${on ? BRAND : 'transparent'}`,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontSize: 13.5,
                fontWeight: on ? 800 : 650,
                color: on ? c.text : c.textDim,
                transition: 'color .15s, border-color .15s',
              }}
            >
              {t(x.label)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
