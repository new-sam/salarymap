import { useState } from 'react'
import { sectionStyle, sectionTitle } from '../../constants/dashboard'

function Pct({ value, digits = 1 }) {
  return <span>{(value * 100).toFixed(digits)}%</span>
}

function Duration({ seconds }) {
  if (seconds < 60) return <span>{Math.round(seconds)}s</span>
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return <span>{m}m {s}s</span>
}

function BarCell({ value, max, color = '#4F46E5' }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: Math.max(4, pct), height: 16, background: color, borderRadius: 3, opacity: 0.7, minWidth: 4 }} />
      <span style={{ fontWeight: 600, minWidth: 32, textAlign: 'right' }}>{value.toLocaleString()}</span>
    </div>
  )
}

function DataTable({ columns, rows }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
            {columns.map((col, i) => (
              <th key={i} style={{ padding: '8px 12px', textAlign: i === 0 ? 'left' : 'right', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
              {columns.map((col, j) => (
                <td key={j} style={{ padding: '6px 12px', textAlign: j === 0 ? 'left' : 'right', whiteSpace: 'nowrap', ...col.style }}>
                  {col.render ? col.render(row, rows) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const SUB_TABS = [
  { key: 'channel', label: '1. By Channel' },
  { key: 'daily', label: '2. Daily Trend' },
  { key: 'device', label: '3. By Device' },
  { key: 'landing', label: '4. Landing Pages' },
  { key: 'utm', label: '5. UTM Report' },
]

export default function GA4View({ ga4, t }) {
  const [subTab, setSubTab] = useState('channel')

  if (!ga4) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{t.loadingData}</div>

  const { channels, daily, devices, landingPages, totals, utmReport } = ga4

  return (
    <>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: t.ga4Sessions, value: totals.sessions, color: '#4F46E5' },
          { label: t.ga4TotalUsers, value: totals.totalUsers, color: '#10B981' },
          { label: t.ga4NewUsers, value: totals.newUsers, color: '#F59E0B' },
          { label: t.ga4EngagedSessions, value: totals.engagedSessions, color: '#EC4899' },
          { label: t.ga4BounceRate, value: `${(totals.bounceRate * 100).toFixed(1)}%`, color: '#EF4444' },
          { label: t.ga4AvgDuration, value: `${Math.round(totals.avgDuration)}s`, color: '#8B5CF6' },
        ].map(item => (
          <div key={item.label} style={{
            background: '#fff', border: '2px solid #e5e7eb', borderRadius: 12, padding: '16px 20px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: item.color }}>
              {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Sub-tab switcher */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '2px solid #e5e7eb' }}>
        {SUB_TABS.map(tab => (
          <button key={tab.key} onClick={() => setSubTab(tab.key)}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: 'none', borderBottom: subTab === tab.key ? '2px solid #4F46E5' : '2px solid transparent',
              background: 'none', color: subTab === tab.key ? '#4F46E5' : '#999',
              marginBottom: -2, transition: 'all 0.15s',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. By Channel */}
      {subTab === 'channel' && (
        <div style={sectionStyle}>
          <h3 style={sectionTitle}>{t.ga4ByChannel}</h3>
          <DataTable
            columns={[
              { label: t.ga4Channel, key: 'channel' },
              { label: t.ga4Sessions, render: (r, rows) => <BarCell value={r.sessions} max={rows[0]?.sessions} /> },
              { label: t.ga4TotalUsers, render: r => r.totalUsers.toLocaleString() },
              { label: t.ga4NewUsers, render: r => r.newUsers.toLocaleString() },
              { label: t.ga4EngagedSessions, render: r => r.engagedSessions.toLocaleString() },
              { label: t.ga4BounceRate, render: r => <Pct value={r.bounceRate} />, style: { color: '#EF4444' } },
              { label: t.ga4AvgDuration, render: r => <Duration seconds={r.avgDuration} /> },
              { label: t.ga4Conversions, render: r => r.conversions.toLocaleString(), style: { fontWeight: 600, color: '#10B981' } },
            ]}
            rows={channels}
          />
        </div>
      )}

      {/* 2. Daily Trend */}
      {subTab === 'daily' && (
        <div style={sectionStyle}>
          <h3 style={sectionTitle}>Daily Trend</h3>
          <DataTable
            columns={[
              { label: 'Date', key: 'date' },
              { label: t.ga4Sessions, render: (r, rows) => <BarCell value={r.sessions} max={Math.max(...rows.map(x => x.sessions))} /> },
              { label: t.ga4TotalUsers, render: r => r.totalUsers.toLocaleString() },
              { label: t.ga4NewUsers, render: r => r.newUsers.toLocaleString() },
              { label: t.ga4EngagedSessions, render: r => r.engagedSessions.toLocaleString() },
            ]}
            rows={daily}
          />
        </div>
      )}

      {/* 3. By Device */}
      {subTab === 'device' && (
        <div style={sectionStyle}>
          <h3 style={sectionTitle}>{t.ga4ByDevice}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${devices.length}, 1fr)`, gap: 16, marginBottom: 16 }}>
            {devices.map((d, i) => {
              const totalSessions = devices.reduce((s, x) => s + x.sessions, 0)
              const pct = totalSessions > 0 ? ((d.sessions / totalSessions) * 100).toFixed(1) : 0
              return (
                <div key={d.device} style={{
                  background: '#f9fafb', borderRadius: 12, padding: 20, textAlign: 'center',
                  border: i === 0 ? '2px solid #4F46E5' : '1px solid #e5e7eb',
                }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>
                    {d.device === 'mobile' ? '📱' : d.device === 'desktop' ? '🖥️' : '📟'}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, textTransform: 'capitalize', marginBottom: 4 }}>{d.device}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#4F46E5' }}>{d.sessions.toLocaleString()}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>{pct}%</div>
                  <div style={{ marginTop: 8, fontSize: 11, color: '#9CA3AF' }}>
                    {t.ga4BounceRate}: <Pct value={d.bounceRate} /> | <Duration seconds={d.avgDuration} />
                  </div>
                </div>
              )
            })}
          </div>
          <DataTable
            columns={[
              { label: 'Device', key: 'device', render: r => <span style={{ textTransform: 'capitalize' }}>{r.device}</span> },
              { label: t.ga4Sessions, render: (r, rows) => <BarCell value={r.sessions} max={rows[0]?.sessions} /> },
              { label: t.ga4TotalUsers, render: r => r.totalUsers.toLocaleString() },
              { label: t.ga4EngagedSessions, render: r => r.engagedSessions.toLocaleString() },
              { label: t.ga4BounceRate, render: r => <Pct value={r.bounceRate} />, style: { color: '#EF4444' } },
              { label: t.ga4AvgDuration, render: r => <Duration seconds={r.avgDuration} /> },
            ]}
            rows={devices}
          />
        </div>
      )}

      {/* 4. Landing Pages */}
      {subTab === 'landing' && (
        <div style={sectionStyle}>
          <h3 style={sectionTitle}>{t.ga4LandingPages}</h3>
          <DataTable
            columns={[
              { label: t.ga4Page, render: r => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.page}</span> },
              { label: t.ga4Sessions, render: (r, rows) => <BarCell value={r.sessions} max={rows[0]?.sessions} color="#8B5CF6" /> },
              { label: t.ga4TotalUsers, render: r => r.totalUsers.toLocaleString() },
              { label: t.ga4EngagedSessions, render: r => r.engagedSessions.toLocaleString() },
              { label: t.ga4BounceRate, render: r => <Pct value={r.bounceRate} />, style: { color: '#EF4444' } },
              { label: t.ga4Conversions, render: r => r.conversions.toLocaleString(), style: { fontWeight: 600, color: '#10B981' } },
            ]}
            rows={landingPages}
          />
        </div>
      )}

      {/* 5. UTM Report */}
      {subTab === 'utm' && (
        <div style={sectionStyle}>
          <h3 style={sectionTitle}>UTM Report</h3>
          {utmReport && utmReport.length > 0 ? (
            <DataTable
              columns={[
                { label: 'Source', key: 'source', render: r => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.source}</span> },
                { label: 'Medium', key: 'medium', render: r => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.medium}</span> },
                { label: 'Campaign', key: 'campaign', render: r => <span style={{ fontSize: 12 }}>{r.campaign}</span> },
                { label: 'Content', key: 'content', render: r => <span style={{ fontSize: 12, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}>{r.content}</span> },
                { label: t.ga4Sessions, render: (r, rows) => <BarCell value={r.sessions} max={rows[0]?.sessions} color="#F59E0B" /> },
                { label: t.ga4TotalUsers, render: r => r.totalUsers.toLocaleString() },
                { label: t.ga4NewUsers, render: r => r.newUsers.toLocaleString() },
                { label: t.ga4EngagedSessions, render: r => r.engagedSessions.toLocaleString() },
                { label: t.ga4BounceRate, render: r => <Pct value={r.bounceRate} />, style: { color: '#EF4444' } },
                { label: t.ga4AvgDuration, render: r => <Duration seconds={r.avgDuration} /> },
              ]}
              rows={utmReport}
            />
          ) : (
            <div style={{ color: '#aaa', fontSize: 13, padding: 20, textAlign: 'center' }}>No UTM data available.</div>
          )}
        </div>
      )}
    </>
  )
}
