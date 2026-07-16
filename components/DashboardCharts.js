import { useState, useEffect } from 'react'
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend
} from 'recharts'

// 모바일(≤768px)에서는 좁은 폭에 맞춰 우측 여백/축을 줄인다.
function useIsMobile() {
  const [m, setM] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const on = () => setM(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return m
}

function ExpLabel({ viewBox, index, color, title }) {
  const x = viewBox?.x ?? 0
  return (
    <foreignObject x={x - 12} y={0} width={24} height={24} style={{ overflow: 'visible' }}>
      <div style={{ position: 'relative', width: 24, height: 24 }} className="exp-label-wrap">
        <div style={{
          width: 20, height: 20, borderRadius: '50%', background: color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer',
          margin: '2px auto',
        }}>{index}</div>
        <div className="exp-label-tooltip" style={{
          position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: '#333', color: '#fff', fontSize: 11, fontWeight: 500,
          padding: '4px 8px', borderRadius: 6, whiteSpace: 'nowrap',
          pointerEvents: 'none', opacity: 0, transition: 'opacity 0.15s',
        }}>{title}</div>
        <style>{`
          .exp-label-wrap:hover .exp-label-tooltip { opacity: 1 !important; }
        `}</style>
      </div>
    </foreignObject>
  )
}

function MultiTooltip({ active, payload, label, daily, metrics, experiments, lang }) {
  if (!active || !payload || !payload.length) return null
  const dayLabels = lang === 'en'
    ? ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    : ['일','월','화','수','목','금','토']
  const dayOfWeek = dayLabels[new Date(label + 'T00:00:00').getDay()]
  const idx = daily.findIndex(d => d.date === label)
  const exps = experiments.filter(e => e.date === label)

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label} ({dayOfWeek})</div>
      {metrics.map(metric => {
        const entry = payload.find(p => p.dataKey === metric.dataKey)
        const val = entry?.value
        if (val === null || val === undefined) return null
        let change = null
        if (idx > 0) {
          const prev = daily[idx - 1][metric.dataKey]
          if (prev !== null && prev > 0) change = Math.round(((val - prev) / prev) * 100)
        }
        return (
          <div key={metric.key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: metric.color, flexShrink: 0 }} />
            <span>{metric.label}: {val}</span>
            {change !== null && (
              <span style={{ fontWeight: 600, fontSize: 11, color: change > 0 ? '#EF4444' : change < 0 ? '#3B82F6' : '#9CA3AF' }}>
                ({change > 0 ? '+' : ''}{change}%)
              </span>
            )}
          </div>
        )
      })}
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

export default function MetricChart({ daily, metrics, experiments = [], avgLabel = '평균', lang = 'ko', dualAxis = true, lineType = 'monotone', dots = true }) {
  const metricList = Array.isArray(metrics) ? metrics : [metrics]
  const isMulti = metricList.length > 1
  const useDualAxis = isMulti && metricList.length === 2 && dualAxis
  const isMobile = useIsMobile()

  const dateSet = new Set(daily.map(d => d.date))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={daily} margin={{ top: 25, right: isMobile ? 12 : 70, left: 0, bottom: 0 }}>
        <defs>
          {metricList.map(m => (
            <linearGradient key={m.key} id={`grad-${m.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={m.color} stopOpacity={isMulti ? 0.1 : 0.2} />
              <stop offset="95%" stopColor={m.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tickFormatter={d => d.slice(5)} fontSize={12} />
        <YAxis yAxisId="left" fontSize={12} stroke={useDualAxis ? metricList[0].color : undefined} />
        {useDualAxis && (
          <YAxis yAxisId="right" orientation="right" fontSize={12} stroke={metricList[1].color} />
        )}
        <Tooltip content={<MultiTooltip daily={daily} metrics={metricList} experiments={experiments} lang={lang} />} />

        {!isMulti && (() => {
          const m = metricList[0]
          const validDays = daily.filter(d => d[m.dataKey] !== null && d[m.dataKey] !== undefined)
          const avg = validDays.length > 0
            ? Math.round(validDays.reduce((s, d) => s + d[m.dataKey], 0) / validDays.length)
            : 0
          return (
            <ReferenceLine yAxisId="left" y={avg} stroke={m.color} strokeDasharray="4 4" strokeOpacity={0.5}
              label={{ value: `${avgLabel}: ${avg}`, position: isMobile ? 'insideTopRight' : 'right', fontSize: 11, fill: '#999' }} />
          )
        })()}

        {experiments.filter(e => dateSet.has(e.date)).map((exp, i) => (
          <ReferenceLine key={exp.id} yAxisId="left" x={exp.date} stroke={exp.color} strokeDasharray="4 4" strokeWidth={2}
            label={<ExpLabel index={i + 1} color={exp.color} title={exp.title} />} />
        ))}

        {metricList.map((m, i) => (
          <Area
            key={m.key}
            yAxisId={useDualAxis && i === 1 ? 'right' : 'left'}
            type={lineType} dataKey={m.dataKey} name={m.label}
            stroke={m.color} strokeWidth={2.5}
            fill={`url(#grad-${m.key})`}
            dot={dots ? { r: 3, fill: m.color, strokeWidth: 0 } : false}
            activeDot={{ r: 5, fill: m.color, strokeWidth: 2, stroke: '#fff' }}
            connectNulls={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}
