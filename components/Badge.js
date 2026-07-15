import { badgeVisual } from '../lib/badgeVisuals'
import { getSalaryTierByKey } from '../lib/salaryTiers'

// 마커용 인라인 SVG — 메달 아트가 본체가 되면서 크라운 마커만 남음.
const ICON_PATHS = {
  medal: ['M12 14a6 6 0 100-12 6 6 0 000 12z', 'M9 13.5L7 22l5-3 5 3-2-8.5'],
  crown: ['M5 16L3 7l5.5 4L12 4l3.5 7L21 7l-2 9z', 'M5 20h14'],
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

// 앱과 동일한 메달 일러스트 에셋 (public/badges/*.webp, 파일명 = 뱃지 키).
const medalSrc = (key) => `/badges/${key}.webp`

// 잠금 실루엣 색 — 앱 badge-medal.tsx SILHOUETTE와 동일.
const SILHOUETTE = '#C7CCD3'

// 뱃지(연봉 등급 + 참여형 공통) 렌더. 모바일 BadgeMedal/BadgeTile의 웹 대응 — 동일 메달 아트 사용.
//   variant="pill"  커뮤니티 글·댓글 인라인 알약(라벨 포함)
//   variant="md"    프로필 그리드 타일 메달(72)
//   variant="lg"    대표 영역/상세 메달(92)
// earned=false면 잠금(회색 실루엣 + 자물쇠), gold는 크라운 마커.
export default function Badge({ keyName, t, variant = 'pill', earned = true, isRep = false }) {
  const v = badgeVisual(keyName)
  if (!v) return null

  if (variant === 'pill') {
    // 커뮤니티 author 인라인 — 미니 메달 이미지 + 라이트 뉴트럴 알약 (앱 author-meta와 동일 무드)
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: v.gold ? '#fdf3d8' : '#f4f4f2',
        color: v.gold ? '#a16207' : '#555',
        fontSize: 10, fontWeight: 800, lineHeight: 1.4,
        padding: '1px 7px 1px 3px', borderRadius: 100, whiteSpace: 'nowrap',
        letterSpacing: '-0.2px', verticalAlign: 'middle',
      }}>
        <img src={medalSrc(keyName)} alt="" width={14} height={14}
          style={{ width: 14, height: 14, objectFit: 'contain', display: 'block' }} />
        {badgeLabel(keyName, t)}
      </span>
    )
  }

  const size = variant === 'lg' ? 92 : 72
  const src = medalSrc(keyName)

  if (!earned) {
    // 앱 스펙: 회색 실루엣(mask로 알파채널만) + 중앙 자물쇠 원형(지름 42%, 아이콘 24%).
    const lockCircle = size * 0.42
    const lockIcon = size * 0.24
    return (
      <div style={{ width: size, height: size, flexShrink: 0, position: 'relative' }}>
        <span style={{
          position: 'absolute', inset: 0, background: SILHOUETTE,
          WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`,
          WebkitMaskSize: 'contain', maskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center', maskPosition: 'center',
        }} />
        <span style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: lockCircle, height: lockCircle, borderRadius: '50%', background: '#fff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width={lockIcon} height={lockIcon} viewBox="0 0 24 24" fill="none" stroke="#9AA0A8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="11" width="16" height="10" rx="2" fill="#9AA0A8" stroke="none" />
            <path d="M8 11V7a4 4 0 018 0v4" />
          </svg>
        </span>
      </div>
    )
  }

  return (
    <div style={{ width: size, height: size, flexShrink: 0, position: 'relative' }}>
      <img src={src} alt={badgeLabel(keyName, t)} width={size} height={size}
        style={{ width: size, height: size, objectFit: 'contain', display: 'block' }} />
      {v.gold && (
        <span style={{
          position: 'absolute', top: 0, left: 0, width: size * 0.26, height: size * 0.26,
          borderRadius: '50%', background: '#F59E0B', border: '1.5px solid #fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
        }}>
          <BadgeIcon name="crown" size={size * 0.15} color="#fff" />
        </span>
      )}
      {isRep && (
        <span style={{ position: 'absolute', top: 0, right: 0, background: 'rgba(0,0,0,0.4)', borderRadius: 999, padding: '2px 6px', fontSize: 9, fontWeight: 900, color: '#fff', letterSpacing: 0.2 }}>
          {t ? t('profile.badges.representative') : '대표'}
        </span>
      )}
    </div>
  )
}
