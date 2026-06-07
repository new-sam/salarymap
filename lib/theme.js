// Design tokens — 토스/Vteam 스타일 기반의 ATS 디자인 시스템.
// 모든 색상·타이포·간격은 이 파일에서 시작한다.
// 신규 컴포넌트는 인라인 hex/px 대신 이 토큰을 참조.

// ── COLORS ─────────────────────────────────────────────────────────
// 토스식 회색 11단계 + 우리 브랜드 주황 + 의미별 시그널.

const orange = {
  50:  '#FFF7ED',
  100: '#FFEDD5',
  200: '#FED7AA',
  300: '#FDBA74',
  400: '#FB923C',
  500: '#F97316',  // 브랜드 메인
  600: '#EA580C',
  700: '#C2410C',
  800: '#9A3412',
  900: '#7C2D12',
};

// 토스 그레이 — 차가운 회색 톤. 우리도 차분한 톤으로 통일.
const gray = {
  0:   '#FFFFFF',
  50:  '#F9FAFB',  // 배경
  100: '#F2F4F6',  // 카드 hover, subtle bg
  200: '#E5E8EB',  // 보더, 디바이더
  300: '#D1D6DB',
  400: '#B0B8C1',  // 비활성 텍스트
  500: '#8B95A1',  // placeholder
  600: '#6B7684',  // 보조 텍스트
  700: '#4E5968',  // 본문 (light 모드)
  800: '#333D4B',  // 강한 텍스트
  900: '#191F28',  // 제목 / 최강 텍스트
};

const semantic = {
  success: { bg: '#ECFDF5', border: '#A7F3D0', fg: '#047857', solid: '#10B981' },
  warning: { bg: '#FFFBEB', border: '#FDE68A', fg: '#B45309', solid: '#F59E0B' },
  danger:  { bg: '#FEF2F2', border: '#FECACA', fg: '#B91C1C', solid: '#EF4444' },
  info:    { bg: '#EFF6FF', border: '#BFDBFE', fg: '#1D4ED8', solid: '#3B82F6' },
};

export const color = {
  primary: orange,
  gray,
  ...semantic,
  white: '#FFFFFF',
  black: '#000000',

  // 의미 alias — 호출부에서 의미 위주로 쓰기 위해.
  bg:        gray[50],
  surface:   gray[0],     // 카드 배경
  border:    gray[200],
  divider:   gray[200],
  textHi:    gray[900],   // 큰 제목, KPI
  text:      gray[800],   // 본문 강조
  textSub:   gray[600],   // 보조 정보
  textMute:  gray[400],   // 비활성
  brand:     orange[500],
  brandDeep: orange[600],
};

// ── TYPOGRAPHY ──────────────────────────────────────────────────────
// 토스 톤: 큰 위계 + 본문 14~15px

export const font = {
  family: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  size: {
    xs:   11,
    sm:   12,
    base: 14,   // 본문 기본 (이전 12~13에서 상향)
    md:   15,
    lg:   16,
    xl:   18,
    '2xl': 20,
    '3xl': 24,
    '4xl': 28,
    '5xl': 32,
    '6xl': 40,
    kpi:  36,   // KPI 큰 숫자 강조용
  },
  weight: {
    regular: 400,
    medium:  500,
    semi:    600,
    bold:    700,
    extra:   800,
    black:   900,
  },
  lineHeight: {
    tight:   1.2,
    normal:  1.5,
    relaxed: 1.65,
  },
  letterSpacing: {
    tight:  '-0.02em',
    normal: '0',
  },
};

// ── SPACING (4px 베이스) ───────────────────────────────────────────
// 토스/Vteam은 여백을 컨텐츠 일부로 취급. 기본 단위 키움.

export const space = {
  0:  0,
  1:  4,
  2:  8,
  3:  12,
  4:  16,
  5:  20,
  6:  24,
  8:  32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
};

// ── RADIUS ──────────────────────────────────────────────────────────
// 토스 톤: 카드 14~16, 모달 20~24, pill 9999.

export const radius = {
  none: 0,
  sm:   6,
  md:   10,
  lg:   14,    // 카드 기본
  xl:   16,    // 큰 카드
  '2xl': 20,   // 모달
  '3xl': 24,
  full: 9999,
};

// ── SHADOW ──────────────────────────────────────────────────────────
// 미묘한 elevation. 호버 시 한 단계 위.

export const shadow = {
  none: 'none',
  xs:   '0 1px 2px rgba(17,24,39,0.04)',
  sm:   '0 1px 3px rgba(17,24,39,0.06), 0 1px 2px rgba(17,24,39,0.04)',
  md:   '0 4px 12px rgba(17,24,39,0.08), 0 2px 4px rgba(17,24,39,0.04)',
  lg:   '0 10px 25px rgba(17,24,39,0.10), 0 4px 10px rgba(17,24,39,0.05)',
  xl:   '0 20px 50px rgba(17,24,39,0.15)',

  // 컬러 그림자 (브랜드 강조 버튼 등)
  brand: '0 6px 16px rgba(234,88,12,0.25)',
  danger: '0 6px 16px rgba(220,38,38,0.20)',
  success: '0 6px 16px rgba(16,185,129,0.20)',
};

// ── TRANSITION ──────────────────────────────────────────────────────
// 토스의 스프링 느낌 위해 ease-out 강조.

export const motion = {
  duration: {
    fast: '120ms',
    base: '180ms',
    slow: '300ms',
  },
  easing: {
    standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring:   'cubic-bezier(0.16, 1, 0.3, 1)',  // overshoot 느낌 (토스)
    decel:    'cubic-bezier(0, 0, 0.2, 1)',
  },
  // 자주 쓰는 조합
  base:  'all 180ms cubic-bezier(0.4, 0, 0.2, 1)',
  hover: 'all 180ms cubic-bezier(0.16, 1, 0.3, 1)',
};

// ── ATS 전용 합성 토큰 ──────────────────────────────────────────────
// 자주 등장하는 패턴은 미리 합성해서 쓰기 편하게.

export const styles = {
  // 카드 기본
  card: {
    background: color.surface,
    border: `1px solid ${color.border}`,
    borderRadius: radius.lg,
    padding: space[5],
    boxShadow: shadow.xs,
    transition: motion.base,
  },
  // 호버시 살짝 떠오르는 카드 (인터랙티브)
  cardHover: {
    boxShadow: shadow.md,
    transform: 'translateY(-1px)',
  },
  // 모달 박스
  modalBox: {
    background: color.surface,
    borderRadius: radius['2xl'],
    boxShadow: shadow.xl,
  },
  // 모달 오버레이
  modalOverlay: {
    background: 'rgba(17, 24, 39, 0.45)',
    backdropFilter: 'blur(2px)',
  },
  // 본문 텍스트
  bodyText: {
    fontFamily: font.family,
    fontSize: font.size.base,
    lineHeight: font.lineHeight.normal,
    color: color.text,
  },
  // 큰 제목
  h1: {
    fontFamily: font.family,
    fontSize: font.size['4xl'],
    fontWeight: font.weight.extra,
    color: color.textHi,
    letterSpacing: font.letterSpacing.tight,
    lineHeight: font.lineHeight.tight,
  },
  // 섹션 제목
  h2: {
    fontFamily: font.family,
    fontSize: font.size.xl,
    fontWeight: font.weight.bold,
    color: color.textHi,
    lineHeight: font.lineHeight.tight,
  },
  // KPI 큰 숫자
  kpiNumber: {
    fontFamily: font.family,
    fontSize: font.size.kpi,
    fontWeight: font.weight.black,
    color: color.textHi,
    letterSpacing: font.letterSpacing.tight,
    lineHeight: font.lineHeight.tight,
  },
  // KPI 라벨
  kpiLabel: {
    fontFamily: font.family,
    fontSize: font.size.sm,
    fontWeight: font.weight.semi,
    color: color.textSub,
  },
  // 입력 필드
  input: {
    background: color.surface,
    border: `1px solid ${color.border}`,
    borderRadius: radius.md,
    padding: `${space[3]}px ${space[4]}px`,
    fontSize: font.size.base,
    fontFamily: font.family,
    color: color.text,
    outline: 'none',
    transition: motion.base,
  },
  // 버튼 — 브랜드 (Primary CTA)
  btnBrand: {
    background: color.brand,
    color: color.white,
    border: 'none',
    borderRadius: radius.md,
    padding: `${space[3]}px ${space[5]}px`,
    fontSize: font.size.base,
    fontWeight: font.weight.bold,
    fontFamily: font.family,
    cursor: 'pointer',
    boxShadow: shadow.brand,
    transition: motion.base,
  },
  // 버튼 — 보조 (Secondary)
  btnGhost: {
    background: color.surface,
    color: color.text,
    border: `1px solid ${color.border}`,
    borderRadius: radius.md,
    padding: `${space[3]}px ${space[5]}px`,
    fontSize: font.size.base,
    fontWeight: font.weight.semi,
    fontFamily: font.family,
    cursor: 'pointer',
    transition: motion.base,
  },
  // 버튼 — 위험 (Danger)
  btnDanger: {
    background: color.danger.solid,
    color: color.white,
    border: 'none',
    borderRadius: radius.md,
    padding: `${space[3]}px ${space[5]}px`,
    fontSize: font.size.base,
    fontWeight: font.weight.bold,
    fontFamily: font.family,
    cursor: 'pointer',
    boxShadow: shadow.danger,
    transition: motion.base,
  },
  // 배지/뱃지
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: space[1],
    padding: `${space[1]}px ${space[2]}px`,
    borderRadius: radius.full,
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
  },
};

// 헬퍼: 의미별 배지 색
export const badgeTone = {
  brand:   { background: color.primary[100], color: color.primary[700] },
  success: { background: color.success.bg, color: color.success.fg },
  warning: { background: color.warning.bg, color: color.warning.fg },
  danger:  { background: color.danger.bg,  color: color.danger.fg  },
  info:    { background: color.info.bg,    color: color.info.fg    },
  neutral: { background: color.gray[100],  color: color.gray[700]  },
};

// 기본 export로 묶어서 한 줄 import도 가능하게.
const theme = { color, font, space, radius, shadow, motion, styles, badgeTone };
export default theme;
