import { badgeVisual } from '../lib/badgeVisuals'
import { getSalaryTierByKey } from '../lib/salaryTiers'

// 뱃지 아이콘 — 그룹별 SF Symbol을 인라인 SVG로 대응(모바일 badge-visuals.ts 아이콘과 매칭).
const ICON_PATHS = {
  rosette: ['M12 15a6 6 0 100-12 6 6 0 000 12z', 'M9 13.5L7 22l5-3 5 3-2-8.5'],
  medal: ['M12 14a6 6 0 100-12 6 6 0 000 12z', 'M9 13.5L7 22l5-3 5 3-2-8.5'],
  crown: ['M5 16L3 7l5.5 4L12 4l3.5 7L21 7l-2 9z', 'M5 20h14'],
  diamond: ['M6 3h12l4 6-10 12L2 9z', 'M6 3l3 6m9-6l-3 6M2 9h20'],
  paperplane: ['M22 2L11 13', 'M22 2l-7 20-4-9-9-4z'],
  pencil: ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z'],
  bubbles: ['M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z'],
  heart: ['M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z'],
  thumbsup: ['M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3z', 'M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3'],
  flame: ['M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 002.5 2.5z'],
}

function BadgeIcon({ name, size, color = '#fff' }) {
  const paths = ICON_PATHS[name] || ICON_PATHS.medal
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  )
}

// i18n 라벨 — 연봉은 salary.tier.*, 참여형은 badge.name.*.
export function badgeLabel(key, t) {
  if (!t) return key
  return getSalaryTierByKey(key) ? t(`salary.tier.${key}`) : t(`badge.name.${key}`)
}

// 뱃지(연봉 등급 + 참여형 공통) 렌더. 모바일 BadgeTile/featured/커뮤니티 칩의 웹 대응.
//   variant="pill"  커뮤니티 글·댓글 인라인 알약(라벨 포함)
//   variant="md"    프로필 그리드 타일 메달(72)
//   variant="lg"    대표 영역/상세 메달(92)
// earned=false면 잠금(회색). gold는 금테.
export default function Badge({ keyName, t, variant = 'pill', earned = true, isRep = false }) {
  const v = badgeVisual(keyName)
  if (!v) return null
  const grad = `linear-gradient(135deg,${v.colors[0]},${v.colors[1]})`

  if (variant === 'pill') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        background: grad, color: '#fff',
        fontSize: 10, fontWeight: 800, lineHeight: 1.4,
        padding: '1px 6px 1px 5px', borderRadius: 5, whiteSpace: 'nowrap',
        letterSpacing: '-0.2px', verticalAlign: 'middle',
        ...(v.gold ? { border: '1px solid #fff3cf' } : {}),
      }}>
        <BadgeIcon name={v.icon} size={9} />
        {badgeLabel(keyName, t)}
      </span>
    )
  }

  const size = variant === 'lg' ? 92 : 72
  const radius = variant === 'lg' ? 26 : 20
  const iconSize = variant === 'lg' ? 44 : 32
  return (
    <div style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0, position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      ...(earned
        ? { background: grad, boxShadow: `0 6px 14px ${v.colors[1]}40`, ...(v.gold ? { border: '2.5px solid #fff7e0' } : {}) }
        : { background: v.gold ? '#fbf4df' : '#f1f3f6' }),
    }}>
      {earned && (
        <span style={{ position: 'absolute', top: -size * 0.35, left: -size * 0.35, width: size, height: size, borderRadius: '50%', background: 'rgba(255,255,255,0.28)' }} />
      )}
      <BadgeIcon name={v.icon} size={iconSize} color={earned ? '#fff' : (v.gold ? '#d6b45c' : '#c4c9d0')} />
      {earned && isRep && (
        <span style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(0,0,0,0.4)', borderRadius: 999, padding: '2px 6px', fontSize: 9, fontWeight: 900, color: '#fff', letterSpacing: 0.2 }}>
          {t ? t('profile.badges.representative') : '대표'}
        </span>
      )}
    </div>
  )
}
