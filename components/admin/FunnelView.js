import { useState } from 'react'
import { PRESET_FUNNELS, MAX_BAR_HEIGHT, sectionStyle } from '../../constants/dashboard'
import { sumDailyFrom } from '../../utils/dashboard'

export default function FunnelView({ data, metrics, summary, funnelKeys, setFunnelKeys, t, lang }) {
  const C = '#4F46E5'
  const presets = PRESET_FUNNELS[lang] || PRESET_FUNNELS.en
  const [expandedPreset, setExpandedPreset] = useState(null)

  const stages = funnelKeys.map(k => {
    const m = metrics.find(x => x.key === k)
    return { ...m, value: summary[m.summaryKey] ?? 0 }
  })
  const firstVal = stages[0]?.value || 1

  function renderDetailChart(stageList) {
    const maxVal = Math.max(...stageList.map(s => s.value), 1)
    const fv = stageList[0]?.value || 0
    return (
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: MAX_BAR_HEIGHT }}>
          {stageList.map((stage, i) => {
            const barHeight = Math.max(4, (stage.value / maxVal) * MAX_BAR_HEIGHT)
            return (
              <div key={stage.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C, marginBottom: 4 }}>{stage.value.toLocaleString()}</div>
                <div style={{ width: '70%', height: barHeight, background: C, opacity: 1 - (i / stageList.length) * 0.5, borderRadius: '4px 4px 0 0' }} />
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          {stageList.map((stage) => (
            <div key={stage.key} style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#555' }}>{stage.label}</div>
          ))}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 16 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '6px 8px', textAlign: 'left', color: '#666' }}>{t.funnelStep}</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', color: '#666' }}>Count</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', color: '#666' }}>{t.funnelConv}</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', color: '#666' }}>{t.funnelOf}</th>
            </tr>
          </thead>
          <tbody>
            {stageList.map((stage, i) => {
              const prev = i > 0 ? stageList[i - 1].value : null
              const conv = prev && prev > 0 ? ((stage.value / prev) * 100).toFixed(1) : null
              const ofTotal = fv > 0 ? ((stage.value / fv) * 100).toFixed(1) : '0'
              return (
                <tr key={stage.key} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 500 }}>{i + 1}. {stage.label}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{stage.value.toLocaleString()}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: i === 0 ? '#999' : conv >= 50 ? '#10B981' : conv >= 20 ? '#F59E0B' : '#EF4444' }}>{i === 0 ? '-' : `${conv}%`}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: '#666' }}>{i === 0 ? '100%' : `${ofTotal}%`}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {presets.map((p, pi) => {
          const sums = sumDailyFrom(data.daily, p.keys.map(k => metrics.find(x => x.key === k)?.dataKey).filter(Boolean), p.since)
          const pStages = p.keys.map(k => {
            const m = metrics.find(x => x.key === k)
            return { ...m, value: sums[m.dataKey] ?? 0 }
          })
          const pFirst = pStages[0]?.value || 0
          const pLast = pStages[pStages.length - 1]?.value || 0
          const overallConv = pFirst > 0 ? ((pLast / pFirst) * 100).toFixed(1) : '0'
          const isOpen = expandedPreset === pi
          return (
            <div key={pi}
              onClick={() => setExpandedPreset(isOpen ? null : pi)}
              style={{
                background: '#fff', border: isOpen ? `2px solid ${C}` : '1px solid #e5e7eb', borderRadius: 12,
                padding: 16, cursor: 'pointer', transition: 'all 0.15s',
              }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#333' }}>{p.name}</div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{p.desc} · {p.since}~</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10 }}>
                <span style={{ fontSize: 11, color: '#999' }}>{pStages[0]?.label} → {pStages[pStages.length - 1]?.label}</span>
                <span style={{ fontSize: 24, fontWeight: 700, color: C }}>{overallConv}%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginTop: 8, gap: 4 }}>
                {pStages.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11, color: '#555', fontWeight: 600 }}>{s.value.toLocaleString()}</span>
                    {i < pStages.length - 1 && <span style={{ fontSize: 10, color: '#ccc' }}>→</span>}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {expandedPreset !== null && (() => {
        const p = presets[expandedPreset]
        const sums = sumDailyFrom(data.daily, p.keys.map(k => metrics.find(x => x.key === k)?.dataKey).filter(Boolean), p.since)
        const pStages = p.keys.map(k => {
          const m = metrics.find(x => x.key === k)
          return { ...m, value: sums[m.dataKey] ?? 0 }
        })
        const pFirst = pStages[0]?.value || 0
        const pLast = pStages[pStages.length - 1]?.value || 0
        const overallConv = pFirst > 0 ? ((pLast / pFirst) * 100).toFixed(1) : '0'
        return (
          <div style={{ ...sectionStyle, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#333' }}>{p.name}</span>
              <div>
                <span style={{ fontSize: 12, color: '#999', marginRight: 8 }}>{p.since}~ · {t.funnelOverall}</span>
                <span style={{ fontSize: 22, fontWeight: 700, color: C }}>{overallConv}%</span>
              </div>
            </div>
            {renderDetailChart(pStages)}
          </div>
        )
      })()}

      <div style={{ ...sectionStyle, paddingBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#333' }}>
            {lang === 'ko' ? '커스텀 퍼널' : 'Custom Funnel'}
            <span style={{ fontWeight: 400, color: '#999', fontSize: 12, marginLeft: 8 }}>
              {funnelKeys.length === 0 ? t.funnelEmpty : `${funnelKeys.length} steps`}
            </span>
          </span>
          {funnelKeys.length > 0 && (
            <button onClick={() => setFunnelKeys([])}
              style={{ padding: '4px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              {t.funnelClear}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {metrics.map(m => {
            const inFunnel = funnelKeys.includes(m.key)
            return (
              <button key={m.key}
                onClick={() => {
                  if (inFunnel) {
                    setFunnelKeys(funnelKeys.filter(k => k !== m.key))
                  } else {
                    setFunnelKeys([...funnelKeys, m.key])
                  }
                }}
                style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  border: inFunnel ? `2px solid ${C}` : '1px solid #d1d5db',
                  background: inFunnel ? C + '12' : '#fff',
                  color: inFunnel ? C : '#666',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                {inFunnel && <span style={{ marginRight: 4 }}>{funnelKeys.indexOf(m.key) + 1}.</span>}
                {m.label}
              </button>
            )
          })}
        </div>
      </div>

      {stages.length >= 2 && (
        <div style={sectionStyle}>
          {renderDetailChart(stages)}
          <div style={{
            marginTop: 16, padding: '10px 16px',
            background: '#f9fafb', borderRadius: 8,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 13, color: '#666' }}>{t.funnelOverall}: {stages[0].label} → {stages[stages.length - 1].label}</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: C }}>
              {firstVal > 0 ? ((stages[stages.length - 1].value / firstVal) * 100).toFixed(2) : 0}%
            </span>
          </div>
        </div>
      )}
    </>
  )
}
