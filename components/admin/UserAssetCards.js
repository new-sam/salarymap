import { useAdmin } from '../../lib/adminSwr'

// 전체(web+app) 유저 자산·관계 누적 카드. 구 KPI 트래커에서 이관, 결 맞는 탭에 분산 배치.
// keys 로 표시할 지표만 골라 렌더한다.
const METRICS = {
  userFollows: { label: '유저 팔로우', accent: '#4F46E5' },
  subscriptions: { label: '구독 (기업)', accent: '#0D9488' },
  verifiedWorkers: { label: '재직 인증', accent: '#334155' },
  approvedVerifications: { label: '승인 완료', accent: '#059669' },
  resumeHolders: { label: '이력서 등록', accent: '#334155' },
  resumePublic: { label: '이력서 공개', accent: '#059669' },
}

export default function UserAssetCards({ token, keys, title = '유저 자산 · 관계' }) {
  const { data: assets } = useAdmin('/api/admin/user-assets', token)
  if (!assets) return null
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>
        {title} <span style={{ fontSize: 11, fontWeight: 500, color: '#9CA3AF', marginLeft: 4 }}>전체(web+app) 누적</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {keys.map((k) => {
          const m = METRICS[k]
          const v = assets[k]
          return (
            <div key={k} style={{ background: '#fff', border: '1px solid #E5E8EB', borderLeft: `3px solid ${m.accent}`, borderRadius: 10, padding: '13px 15px' }}>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6, fontWeight: 600 }}>{m.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: m.accent, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                {v != null ? v.toLocaleString() : '-'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
