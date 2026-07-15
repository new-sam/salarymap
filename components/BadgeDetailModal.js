import { useEffect, useState } from 'react'
import Badge from './Badge'

// 뱃지(연봉 등급 + 참여형 공통)를 누르면 뜨는 바텀시트 — 모바일 badge-detail-sheet.tsx 대응.
// 획득/미획득(earned), 골드 희귀도, 참여형 진행도, 대표 설정/해제를 한 모델로 처리.
// detail: { key, t, earned, label, note, grantedAt, progress:{current,target}, rarity,
//           equippable, representative:'current'|'settable'|null, color,
//           onSetRepresentative, onClearRepresentative, ctaLabel, onCta }
export default function BadgeDetailModal({ detail, onClose }) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (detail) { const id = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(id) }
    setShown(false)
  }, [detail])

  if (!detail) return null
  const { t, earned, color } = detail
  const progress = !earned ? detail.progress : null
  const pct = progress ? Math.min(1, progress.current / progress.target) : 0
  const date = earned && detail.grantedAt ? new Date(detail.grantedAt).toLocaleDateString() : ''

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      opacity: shown ? 1 : 0, transition: 'opacity 0.25s ease',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', width: '100%', maxWidth: 440,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: '12px 24px calc(env(safe-area-inset-bottom, 0px) + 24px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        transform: shown ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.32s cubic-bezier(0.22,1,0.36,1)',
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 999, background: '#e0e3e8', marginBottom: 20 }} />

        <Badge keyName={detail.key} t={t} variant="lg" earned={earned} />

        <div style={{ fontSize: 20, fontWeight: 800, color: '#111', textAlign: 'center', lineHeight: 1.4, letterSpacing: '-0.3px', marginTop: 16 }}>
          {detail.label}
        </div>
        {detail.note && (
          <div style={{ fontSize: 14, color: 'rgba(0,0,0,0.5)', textAlign: 'center', lineHeight: 1.5, marginTop: 10 }}>{detail.note}</div>
        )}

        {/* 희귀도 — 골드 뱃지에만. */}
        {detail.rarity && (
          <div style={{ borderRadius: 999, padding: '7px 12px', marginTop: 14, background: `${color}1A` }}>
            <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '-0.2px', color }}>{detail.rarity}</span>
          </div>
        )}

        {/* 미획득 + 진행도 — 막대 + 현재/목표. */}
        {progress && (
          <div style={{ alignSelf: 'stretch', marginTop: 18 }}>
            <div style={{ height: 10, borderRadius: 999, background: '#eef1f4', overflow: 'hidden' }}>
              <div style={{ height: 10, borderRadius: 999, width: `${pct * 100}%`, background: color }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(0,0,0,0.5)', textAlign: 'right', marginTop: 7 }}>
              {progress.current.toLocaleString()} / {progress.target.toLocaleString()}
            </div>
          </div>
        )}

        {earned && date && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch', gap: 12, background: '#f6f7f9', borderRadius: 14, padding: '14px 16px', marginTop: 18 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'rgba(0,0,0,0.5)' }}>{t('profile.badgeDetail.grantedAt')}</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#111' }}>{date}</span>
          </div>
        )}

        {/* 대표 뱃지 — 공개 중이면 안내+해제, 아니면 설정 버튼. */}
        {earned && detail.representative === 'current' && (
          <>
            <div style={{ alignSelf: 'stretch', textAlign: 'center', border: `1.5px solid ${color}55`, borderRadius: 14, padding: '13px 0', marginTop: 14 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color }}>{t('profile.badgeDetail.representativeCurrent')}</span>
            </div>
            <button type="button" onClick={() => { detail.onClearRepresentative?.(); onClose() }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '12px 8px', marginTop: 4, fontSize: 13, fontWeight: 700, color: 'rgba(0,0,0,0.5)', textDecoration: 'underline' }}>
              {t('profile.badgeDetail.hideRepresentative')}
            </button>
          </>
        )}
        {earned && detail.representative === 'settable' && (
          <button type="button" onClick={() => { detail.onSetRepresentative?.(); onClose() }}
            style={{ alignSelf: 'stretch', border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: color, color: '#fff', borderRadius: 16, padding: '17px 0', marginTop: 14, fontSize: 16, fontWeight: 800 }}>
            {t('profile.badgeDetail.setRepresentative')}
          </button>
        )}

        {/* 획득했지만 장착 불가(일반 뱃지) — 골드만 대표로 달 수 있다는 안내. */}
        {earned && detail.equippable === false && (
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(0,0,0,0.4)', textAlign: 'center', marginTop: 16 }}>{t('profile.badgeDetail.goldOnly')}</div>
        )}

        {/* 미획득 행동 유도 CTA(있으면). */}
        {!earned && detail.ctaLabel && detail.onCta && (
          <button type="button" onClick={() => { detail.onCta?.(); onClose() }}
            style={{ alignSelf: 'stretch', border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: 'var(--sm-accent)', color: '#fff', borderRadius: 16, padding: '17px 0', marginTop: 14, fontSize: 16, fontWeight: 800 }}>
            {detail.ctaLabel}
          </button>
        )}
      </div>
    </div>
  )
}
