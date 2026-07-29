/* K-Tech College 랜딩(/ktc) 공용 토큰.
   본문은 라이트(#f9f9f9) — 다크로 만들었다가 가독성 이슈로 되돌렸다.
   회색 계열은 FYI 디자인 시스템(tailwind.config.js 의 토스식 그레이)과 같은 값을 쓴다.
   상단 FYI GlobalNav 만 다크(#0c0c0b)로 남는다(전역 헤더라 여기서 건드리지 않는다).
   액센트는 FYI 브랜드 오렌지 그대로. 섹션 구성/순서는 원본 ktc-landing 유지. */

export const BRAND = '#ff6000';

export const c = {
  bg: '#f9f9f9',
  bgAlt: '#ffffff',
  text: '#191F28',        // gray-900
  textDim: '#4E5968',     // gray-700
  textFaint: '#8B95A1',   // gray-500
  line: '#E5E8EB',        // gray-200
  lineStrong: '#D1D6DB',  // gray-300
  surface: '#ffffff',
  surfaceHi: '#F2F4F6',   // gray-100
};

export const s = {
  section: { padding: 'clamp(56px, 9vw, 120px) 0' },
  sectionAlt: { padding: 'clamp(56px, 9vw, 120px) 0', background: c.bgAlt },
  container: {
    width: '100%',
    maxWidth: 1180,
    margin: '0 auto',
    padding: '0 clamp(18px, 4vw, 40px)',
  },
  h2: {
    fontSize: 'clamp(24px, 3.6vw, 42px)',
    fontWeight: 800,
    letterSpacing: '-0.025em',
    lineHeight: 1.22,
    color: c.text,
    textAlign: 'center',
    margin: 0,
  },
  sub: {
    marginTop: 14,
    fontSize: 'clamp(14px, 1.5vw, 17px)',
    color: c.textDim,
    textAlign: 'center',
    lineHeight: 1.6,
  },
  card: {
    background: c.surface,
    border: `1px solid ${c.line}`,
    borderRadius: 18,
    padding: 'clamp(22px, 3vw, 32px)',
    // 흰 섹션 위 흰 카드는 테두리만으로 약해 FYI shadow-soft-sm 과 같은 그림자를 얹는다
    boxShadow: '0 1px 3px rgba(17,24,39,0.06), 0 1px 2px rgba(17,24,39,0.04)',
  },
  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '14px 26px',
    borderRadius: 10,
    background: BRAND,
    color: '#fff',
    border: 'none',
    fontSize: 15,
    fontWeight: 750,
    cursor: 'pointer',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  },
  btnGhost: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '14px 26px',
    borderRadius: 10,
    background: 'transparent',
    color: c.text,
    border: `1px solid ${c.lineStrong}`,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  },
};

/* 섹션 앵커 id — 원본(#gioi-thieu 등)과 동일한 구조를 유지하되 영문 슬러그로 통일.
   apply 는 없다 — 지원 폼 섹션을 제거하고 모든 지원 CTA 를 준비중 안내로 보낸다. */
export const ANCHOR = {
  about: 'about',
  who: 'who',
  jobs: 'jobs',
  benefit: 'benefit',
  faq: 'faq',
};

/* 지원 접수 준비중 안내 — CTA 는 이벤트만 쏘고, 모달은 페이지에 한 번만 마운트한다
   (components/ktc/ComingSoonModal.js). 컴포넌트 간 상태 전달이 필요 없어진다. */
export const APPLY_SOON_EVENT = 'ktc-apply-soon';
export function openApplySoon() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(APPLY_SOON_EVENT));
}

/* 앵커 점프 시 제목이 헤더+탭바 뒤로 숨지 않게 하는 오프셋은 .ktc-anchor 클래스가
   담당한다 — 헤더 높이가 화면 폭에 따라 달라져서(64/52) CSS 로 둬야 한다.
   pages/ktc/index.js 의 .ktc-anchor / .ktc-nav-bar / .ktc-tabs-row 참고. */

export function scrollTo(id) {
  if (typeof document === 'undefined') return;
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}
