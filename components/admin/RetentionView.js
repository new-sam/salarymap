import { useAdmin } from '../../lib/adminSwr'

const sectionStyle = {
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 24,
}

export default function RetentionView({ token, t }) {
  const { data, isLoading: loading } = useAdmin('/api/admin/retention', token)

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
