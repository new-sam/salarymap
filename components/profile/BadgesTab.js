import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Badge, { badgeLabel } from '../Badge'
import BadgeDetailModal from '../BadgeDetailModal'
import { getSalaryTier } from '../../lib/salaryTiers'
import { BADGE_BY_KEY, TIER_LADDER, ENGAGEMENT_GROUPS, engagementBadgesByGroup, isEquippable, badgeVisual } from '../../lib/badgeVisuals'

// 프로필 > 뱃지 탭 — 대표 뱃지 + 연봉 등급 사다리 + 참여형 그리드 + 상세 바텀시트.
// representativeBadge는 히어로 헤더와 공유되므로 부모(profile.js)가 소유.
export default function BadgesTab({ token, t, active, representativeBadge, setRepresentativeBadge, onGoEmployment }) {
  const router = useRouter()
  const [badges, setBadges] = useState([])
  const [badgesLoading, setBadgesLoading] = useState(false)
  const [engagement, setEngagement] = useState(null)
  const [badgeDetail, setBadgeDetail] = useState(null)

  useEffect(() => {
    if (!active || !token) return
    setBadgesLoading(true)
    Promise.all([
      fetch('/api/badges', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => { setBadges(d.badges || []); setRepresentativeBadge(d.representative_badge ?? null) })
        .catch(() => {}),
      fetch('/api/badges/engagement', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => setEngagement(d))
        .catch(() => {}),
    ]).finally(() => setBadgesLoading(false))
  }, [active, token])

  // 대표 뱃지 선택/해제 — 커뮤니티 글·댓글에 노출되는 단일 뱃지(모바일과 동일 모델).
  const putBadge = (body) => fetch('/api/badges', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const chooseRepresentative = async (key) => {
    const prev = representativeBadge
    setRepresentativeBadge(key) // 낙관적 반영
    try {
      // 연봉 등급은 노출에 is_active=true가 필요 — 꺼져 있으면 먼저 켠다.
      if (BADGE_BY_KEY[key]?.group === 'salary') {
        const sb = badges.find(b => b.badge_type === 'salary_range')
        if (sb && !sb.is_active) {
          await putBadge({ badge_type: 'salary_range', is_active: true })
          setBadges(p => p.map(b => b.badge_type === 'salary_range' ? { ...b, is_active: true } : b))
        }
      }
      const res = await putBadge({ representative_badge: key })
      if (!res.ok) throw new Error()
    } catch { setRepresentativeBadge(prev) }
  }
  const clearRepresentative = async () => {
    const prev = representativeBadge
    setRepresentativeBadge(null)
    try {
      const res = await putBadge({ representative_badge: null })
      if (!res.ok) throw new Error()
    } catch { setRepresentativeBadge(prev) }
  }

  return (<>
    <div className="pcard">
      <div className="pcard-h">{t('profile.badges.title')}</div>
      <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.5)', lineHeight: 1.6, marginBottom: 20 }}>
        {t('profile.badges.desc')}
      </div>

      {badgesLoading ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#bbb', fontSize: 13 }}>Loading...</div>
      ) : (() => {
        const GROUP_ROUTE = { applications: '/jobs', posts: '/community', comments: '/community', likes_received: '/community', likes_given: '/community' }
        const salaryBadge = badges.find(b => b.badge_type === 'salary_range')
        const tier = getSalaryTier(salaryBadge?.salary_amount)
        const earnedRank = tier ? TIER_LADDER.indexOf(tier.key) : -1
        const earnedEng = engagement?.earned ?? []
        const isEarned = (key) => {
          const v = BADGE_BY_KEY[key]
          if (!v) return false
          if (v.group === 'salary') { const idx = TIER_LADDER.indexOf(key); return idx >= 0 && idx <= earnedRank }
          return earnedEng.includes(key)
        }
        const currentRepKey = (representativeBadge && isEarned(representativeBadge) && isEquippable(representativeBadge)) ? representativeBadge : null
        const hasAnyEarned = earnedRank >= 0 || earnedEng.length > 0
        const grantedAtOf = (key) => BADGE_BY_KEY[key]?.group === 'salary' ? (salaryBadge?.granted_at ?? null) : (badges.find(b => b.badge_type === key)?.granted_at ?? null)

        const openDetail = (key) => {
          const v = BADGE_BY_KEY[key]
          if (!v) return
          const earned = isEarned(key)
          const equippable = isEquippable(key)
          const isRep = currentRepKey === key
          let note, ctaLabel = null, onCta
          if (v.group === 'salary') {
            note = earned ? t(`profile.badgeDetail.congrats.${key}`) : t(`profile.badgeDetail.cond.${key}`)
            if (!earned) { ctaLabel = t('profile.badgeDetail.ctaVerify'); onCta = () => onGoEmployment?.() }
          } else {
            note = t(`badge.desc.${key}`)
            if (!earned && GROUP_ROUTE[v.group]) { ctaLabel = t(`badge.cta.${v.group}`); onCta = () => router.push(GROUP_ROUTE[v.group]) }
          }
          setBadgeDetail({
            key, t, earned, color: v.colors[1], label: badgeLabel(key, t), note,
            grantedAt: earned ? grantedAtOf(key) : null,
            progress: v.metric ? { current: engagement?.metrics?.[v.metric] ?? 0, target: v.threshold } : null,
            rarity: v.gold && v.rarityPct ? t('badge.rarityPct', { pct: v.rarityPct }) : null,
            equippable,
            representative: earned && equippable ? (isRep ? 'current' : 'settable') : null,
            onSetRepresentative: earned && equippable && !isRep ? () => chooseRepresentative(key) : undefined,
            onClearRepresentative: earned && equippable && isRep ? () => clearRepresentative() : undefined,
            ctaLabel, onCta,
          })
        }

        const stateTextFor = (key, earned) => {
          if (earned) return t('profile.badges.earned')
          const v = BADGE_BY_KEY[key]
          if (v?.metric && engagement) return `${(engagement.metrics?.[v.metric] ?? 0).toLocaleString()}/${(v.threshold ?? 0).toLocaleString()}`
          return t('profile.badges.locked')
        }

        const renderTile = (key) => {
          const earned = isEarned(key)
          return (
            <div key={key} onClick={() => openDetail(key)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
              <Badge keyName={key} t={t} variant="md" earned={earned} isRep={currentRepKey === key} />
              <div style={{ fontSize: 12.5, fontWeight: 700, color: earned ? '#111' : 'rgba(0,0,0,0.4)', marginTop: 9, textAlign: 'center', maxWidth: 96, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                {badgeLabel(key, t)}
              </div>
              <div style={{ fontSize: 11, color: earned ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.3)', marginTop: 3, fontWeight: 600 }}>
                {stateTextFor(key, earned)}
              </div>
            </div>
          )
        }

        const sectionTitle = { fontSize: 15, fontWeight: 800, color: '#111', marginTop: 18, paddingTop: 14, borderTop: '1px solid #eef1f4' }
        const grid = { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '22px 8px', paddingTop: 14, paddingBottom: 4 }
        const repVisual = badgeVisual(currentRepKey)

        return (<>
          {/* 나의 대표 뱃지 — 커뮤니티에 노출 중인 뱃지. */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 22 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#111', marginBottom: 16 }}>{t('profile.badges.myRepresentative')}</div>
            {repVisual ? (<>
              <Badge keyName={currentRepKey} t={t} variant="lg" earned />
              <div style={{ fontSize: 16, fontWeight: 800, color: '#111', marginTop: 14 }}>{badgeLabel(currentRepKey, t)}</div>
              <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.5)', textAlign: 'center', lineHeight: 1.5, marginTop: 8 }}>{t('profile.badges.representativeShownHint')}</div>
              <button type="button" onClick={clearRepresentative}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '10px 8px', marginTop: 4, fontSize: 13, fontWeight: 700, color: 'rgba(0,0,0,0.4)', textDecoration: 'underline' }}>
                {t('profile.badgeDetail.hideRepresentative')}
              </button>
            </>) : (<>
              <div style={{ width: 92, height: 92, borderRadius: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f6f8', border: '2px dashed #e3e7ec' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#c4c9d0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              </div>
              <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.5)', textAlign: 'center', lineHeight: 1.5, marginTop: 12, padding: '0 16px' }}>
                {hasAnyEarned ? t('profile.badges.pickRepresentativeHint') : t('profile.badges.noBadgeYetHint')}
              </div>
            </>)}
          </div>

          {/* 연봉 등급 사다리 */}
          <div style={sectionTitle}>{t('badge.group.salary')}</div>
          <div style={grid}>{TIER_LADDER.map(renderTile)}</div>

          {/* 참여형 뱃지 그룹들 */}
          {ENGAGEMENT_GROUPS.map(group => (
            <div key={group}>
              <div style={sectionTitle}>{t(`badge.group.${group}`)}</div>
              <div style={grid}>{engagementBadgesByGroup(group).map(v => renderTile(v.key))}</div>
            </div>
          ))}
        </>)
      })()}
    </div>
    <BadgeDetailModal detail={badgeDetail} onClose={() => setBadgeDetail(null)} />
  </>)
}
