import { useAdmin } from '../../lib/adminSwr'

// 전체(web+app) 유저 자산·관계 누적 카드. 구 KPI 트래커에서 이관, 결 맞는 탭에 분산 배치.
// keys 로 표시할 지표만 골라 렌더한다.
const METRICS = {
  userFollows: { ko: '유저 팔로우', en: 'User follows', vi: 'Lượt theo dõi người dùng' },
  subscriptions: { ko: '구독 (기업)', en: 'Subscriptions (company)', vi: 'Đăng ký nhận tin (công ty)' },
  verifiedWorkers: { ko: '재직 인증', en: 'Employment verified', vi: 'Xác minh đang làm việc' },
  approvedVerifications: { ko: '승인 완료', en: 'Approved', vi: 'Đã duyệt' },
  resumeHolders: { ko: '이력서 등록', en: 'Resumes registered', vi: 'CV đã đăng ký' },
  resumePublic: { ko: '이력서 공개', en: 'Resumes public', vi: 'CV công khai' },
}

export default function UserAssetCards({ token, keys, title, lang }) {
  const L = (ko, en, vi) => (lang === 'vi' ? (vi ?? en) : lang === 'ko' ? ko : en)
  const { data: assets } = useAdmin('/api/admin/user-assets', token)
  if (!assets) return null
  const heading = title || L('유저 자산 · 관계', 'User assets · relations', 'Tài sản · quan hệ người dùng')
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>
        {heading} <span style={{ fontSize: 11, fontWeight: 500, color: '#9CA3AF', marginLeft: 4 }}>{L('전체(web+app) 누적', 'All (web+app) cumulative', 'Lũy kế toàn bộ (web+app)')}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {keys.map((k) => {
          const m = METRICS[k]
          const v = assets[k]
          return (
            <div key={k} style={{ background: '#fff', border: '1px solid #EEF0F2', borderLeft: '3px solid #ff4400', borderRadius: 12, padding: '15px 17px' }}>
              <div style={{ fontSize: 12.5, color: '#6B7280', marginBottom: 6, fontWeight: 600 }}>{m[lang] || m.ko}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#191F28', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.05 }}>
                {v != null ? v.toLocaleString() : '-'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
