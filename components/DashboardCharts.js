import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine
} from 'recharts'

function CustomTooltip({ active, payload, label, daily, metric, experiments }) {
  if (!active || !payload || !payload.length) return null
  const val = payload[0].value
  const idx = daily.findIndex(d => d.date === label)
  let change = null
  if (idx > 0) {
    const prev = daily[idx - 1][metric.dataKey]
    if (prev > 0) change = Math.round(((val - prev) / prev) * 100)
  }
  const exps = experiments.filter(e => e.date === label)

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>{metric.label}: {val}</span>
        {change !== null && (
          <span style={{ fontWeight: 600, color: change > 0 ? '#EF4444' : change < 0 ? '#3B82F6' : '#9CA3AF' }}>
            ({change > 0 ? '+' : ''}{change}%)
          </span>
        )}
      </div>
      {exps.length > 0 && (
        <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid #f3f4f6', fontSize: 11, color: '#666' }}>
          {exps.map(e => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: e.color }} />
              {e.title}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MetricChart({ daily, metric, experiments = [] }) {
  const avg = daily.length > 0
    ? Math.round(daily.reduce((s, d) => s + (d[metric.dataKey] || 0), 0) / daily.length)
    : 0

  const dateSet = new Set(daily.map(d => d.date))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={daily}>
        <defs>
          <linearGradient id={`grad-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={metric.color} stopOpacity={0.2} />
            <stop offset="95%" stopColor={metric.color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tickFormatter={d => d.slice(5)} fontSize={12} />
        <YAxis fontSize={12} />
        <Tooltip content={<CustomTooltip daily={daily} metric={metric} experiments={experiments} />} />
        <ReferenceLine y={avg} stroke={metric.color} strokeDasharray="4 4" strokeOpacity={0.5}
          label={{ value: `평균: ${avg}`, position: 'right', fontSize: 11, fill: '#999' }} />

        {experiments.filter(e => dateSet.has(e.date)).map(exp => (
          <ReferenceLine key={exp.id} x={exp.date} stroke={exp.color} strokeDasharray="4 4" strokeWidth={2}
            label={{ value: exp.title, position: 'top', fontSize: 10, fill: exp.color, fontWeight: 600 }} />
        ))}

        <Area
          type="monotone" dataKey={metric.dataKey} name={metric.label}
          stroke={metric.color} strokeWidth={2.5}
          fill={`url(#grad-${metric.key})`}
          dot={{ r: 3, fill: metric.color, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: metric.color, strokeWidth: 2, stroke: '#fff' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
