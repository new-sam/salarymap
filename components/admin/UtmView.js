import { useState } from 'react'

export default function UtmView({ utm, t }) {
  const [campaignFilter, setCampaignFilter] = useState('all')

  if (!utm || (utm.bySource.length === 0 && utm.byCampaign.length === 0 && utm.byContent.length === 0)) {
    return (
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 40, textAlign: 'center', color: '#999' }}>
        {t.utmNoData}
      </div>
    )
  }

  const filteredContent = campaignFilter === 'all'
    ? utm.byContent
    : utm.byContent

  function UtmTable({ title, data }) {
    if (!data || data.length === 0) return null
    const maxViews = Math.max(...data.map(d => d.views))
    return (
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px 0' }}>{title}</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Name</th>
              <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>{t.utmViews}</th>
              <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>{t.utmSubmissions}</th>
              <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>{t.utmConvRate}</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', width: '30%' }}></th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={row.name} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ padding: '8px 12px', fontWeight: 500 }}>{row.name}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#4F46E5' }}>{row.views}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#10B981' }}>{row.submissions}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: row.convRate === '-' ? '#999' : parseFloat(row.convRate) >= 20 ? '#10B981' : '#F59E0B' }}>
                  {row.convRate === '-' ? '-' : `${row.convRate}%`}
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(row.views / maxViews) * 100}%`, background: '#4F46E5', borderRadius: 4, opacity: 0.7 }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const campaigns = utm.byCampaign.map(c => c.name)

  return (
    <>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 24, display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{t.utmTotalViews}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#4F46E5' }}>{utm.totalPageViews}</div>
        </div>
        {campaigns.length > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#999', marginRight: 4 }}>Campaign:</span>
            <button onClick={() => setCampaignFilter('all')}
              style={{
                padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: campaignFilter === 'all' ? '2px solid #4F46E5' : '1px solid #d1d5db',
                background: campaignFilter === 'all' ? '#4F46E512' : '#fff',
                color: campaignFilter === 'all' ? '#4F46E5' : '#666',
              }}>
              All
            </button>
            {campaigns.map(c => (
              <button key={c} onClick={() => setCampaignFilter(campaignFilter === c ? 'all' : c)}
                style={{
                  padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: campaignFilter === c ? '2px solid #4F46E5' : '1px solid #d1d5db',
                  background: campaignFilter === c ? '#4F46E512' : '#fff',
                  color: campaignFilter === c ? '#4F46E5' : '#666',
                }}>
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {campaignFilter !== 'all' && utm.dailyByCampaign && (
        (() => {
          const campData = utm.dailyByCampaign.find(c => c.name === campaignFilter)
          if (!campData || campData.daily.length === 0) return null
          const maxV = Math.max(...campData.daily.map(d => d.views))
          return (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px 0' }}>{campaignFilter} — {t.utmViews} {t.trend || 'Trend'}</h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120 }}>
                {campData.daily.map(d => (
                  <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                    <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>{d.views}</div>
                    <div style={{
                      width: '100%', maxWidth: 40,
                      height: maxV > 0 ? Math.max(4, (d.views / maxV) * 100) : 4,
                      background: '#4F46E5', borderRadius: '3px 3px 0 0', opacity: 0.8,
                    }} />
                    <div style={{ fontSize: 9, color: '#999', marginTop: 4, transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>
                      {d.date.slice(5)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })()
      )}

      <UtmTable title={t.utmSource} data={utm.bySource} />
      <UtmTable title={t.utmCampaign} data={utm.byCampaign} />
      <UtmTable title={t.utmContent} data={filteredContent} />
    </>
  )
}
