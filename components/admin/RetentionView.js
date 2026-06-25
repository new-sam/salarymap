import { useAdmin } from '../../lib/adminSwr'

const sectionStyle = {
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 24,
}

export default function RetentionView({ token, t }) {
  const { data, isLoading: loading } = useAdmin('/api/admin/retention', token)
  const { data: assets } = useAdmin('/api/admin/user-assets', token)

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{t.retentionLoading}</div>
  if (!data) return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>{t.retentionEmpty}</div>

  const cards = [
    { label: t.retentionTotal, value: data.totalUsers, color: '#374151' },
    { label: t.retentionWAU, value: data.activeIn7d, color: '#2563EB', sub: `${data.totalUsers > 0 ? ((data.activeIn7d / data.totalUsers) * 100).toFixed(1) : 0}%` },
    { label: t.retentionMAU, value: data.activeIn30d, color: '#10B981', sub: `${data.totalUsers > 0 ? ((data.activeIn30d / data.totalUsers) * 100).toFixed(1) : 0}%` },
    { label: 'D1', value: `${data.d1.rate}%`, color: '#F59E0B', sub: `${data.d1.retained}/${data.d1.eligible}` },
    { label: 'D7', value: `${data.d7.rate}%`, color: '#8B5CF6', sub: `${data.d7.retained}/${data.d7.eligible}` },
    { label: 'D30', value: `${data.d30.rate}%`, color: '#EF4444', sub: `${data.d30.retained}/${data.d30.eligible}` },
  ]

  function rateColor(rate) {
    const r = parseFloat(rate)
    if (isNaN(r)) return '#ccc'
    if (r >= 50) return '#065F46'
    if (r >= 30) return '#10B981'
    if (r >= 15) return '#F59E0B'
    return '#EF4444'
  }

  function rateBg(rate) {
    const r = parseFloat(rate)
    if (isNaN(r)) return '#f9fafb'
    if (r >= 50) return '#D1FAE5'
    if (r >= 30) return '#ECFDF5'
    if (r >= 15) return '#FFFBEB'
    return '#FEF2F2'
  }

  return (
    <>
      {/* 전체(web+app) 유저 자산·관계 누적 — 구 KPI 트래커에서 이관 */}
      {assets && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>
            유저 자산 · 관계 <span style={{ fontSize: 11, fontWeight: 500, color: '#9CA3AF', marginLeft: 4 }}>전체(web+app) 누적</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {[
              { label: '유저 팔로우', value: assets.userFollows, accent: '#4F46E5' },
              { label: '구독 (기업)', value: assets.subscriptions, accent: '#0D9488' },
              { label: '재직 인증', value: assets.verifiedWorkers, accent: '#2563EB' },
              { label: '이력서 등록', value: assets.resumeHolders, accent: '#EA580C' },
              { label: '이력서 공개', value: assets.resumePublic, accent: '#DB2777' },
            ].map(c => (
              <div key={c.label} style={{ background: '#fff', border: '1px solid #E5E8EB', borderLeft: `3px solid ${c.accent}`, borderRadius: 10, padding: '13px 15px' }}>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6, fontWeight: 600 }}>{c.label}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: c.accent, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                  {c.value != null ? c.value.toLocaleString() : '-'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        {cards.map(c => (
          <div key={c.label} style={{
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: c.color }}>{c.value}</div>
            {c.sub && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{c.sub}</div>}
          </div>
        ))}
      </div>

      {/* Cohort Retention Table */}
      <div style={sectionStyle}>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px 0' }}>{t.retentionCohort}</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.retentionWeek}</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>{t.retentionUsers}</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: '#374151' }}>W1</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: '#374151' }}>W2</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: '#374151' }}>W3</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: '#374151' }}>W4</th>
              </tr>
            </thead>
            <tbody>
              {data.cohorts.map((c, i) => (
                <tr key={c.week} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 500 }}>{c.week}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>{c.total}</td>
                  {c.weeks.map((w, wi) => (
                    <td key={wi} style={{
                      padding: '8px 12px', textAlign: 'center',
                      background: w ? rateBg(w.rate) : '#f9fafb',
                      color: w ? rateColor(w.rate) : '#ccc',
                      fontWeight: 600,
                    }}>
                      {w ? `${w.rate}%` : '-'}
                      {w && <div style={{ fontSize: 10, fontWeight: 400, color: '#9CA3AF' }}>{w.retained}/{w.eligible}</div>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 12 }}>
          {t.retentionNote}
        </div>
      </div>
    </>
  )
}
