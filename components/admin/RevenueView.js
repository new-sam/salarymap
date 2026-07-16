import { useState } from 'react'
import { useAdmin } from '../../lib/adminSwr'
import MetricChart from '../DashboardCharts'

// 이익 지원 지표 — 우리 이익이 남는 두 창구(기업 등록 공고 + KTC 시드 공고)의 지원.
// 합계·비중 + 추이(일/주/월) + 유입 경로·platform. 데이터: /api/admin/revenue-metrics
// '기업 채용 퍼널'(CompanyView)과 성격이 다른, 매출 관점 전용 화면.

// 일/주/월 집계 — AppMetricsView와 동일 로직. 일=최근 30일, 주(월~일) ~12개, 월 ~6개.
function aggregateBy(rows, metrics, gran) {
  const sorted = [...(rows || [])].sort((a, b) => (a.date < b.date ? -1 : 1))
  if (!sorted.length) return []
  const pad = (n) => String(n).padStart(2, '0')
  const map = {}
  for (const d of sorted) map[d.date] = d
  const lastDate = new Date(sorted[sorted.length - 1].date + 'T00:00:00')
  if (gran === 'day') {
    const out = []
    for (let i = 29; i >= 0; i--) {
      const dt = new Date(lastDate); dt.setDate(lastDate.getDate() - i)
      const key = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
      if (map[key]) { out.push(map[key]); continue }
      const e = { date: key, _empty: true }; metrics.forEach(m => { e[m.dataKey] = 0 }); out.push(e)
    }
    return out
  }
  const periodKey = (dt) => {
    if (gran === 'month') return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`
    const mon = new Date(dt); mon.setDate(dt.getDate() - ((dt.getDay() + 6) % 7))
    return `${mon.getFullYear()}-${pad(mon.getMonth() + 1)}-${pad(mon.getDate())}`
  }
  const windowDays = gran === 'month' ? 183 : 84
  const buckets = {}, order = []
  for (let i = windowDays - 1; i >= 0; i--) {
    const dt = new Date(lastDate); dt.setDate(lastDate.getDate() - i)
    const pkey = periodKey(dt)
    if (!buckets[pkey]) { buckets[pkey] = { date: pkey, _empty: true }; metrics.forEach(m => { buckets[pkey][m.dataKey] = 0 }); order.push(pkey) }
    const row = map[`${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`]
    if (row) { buckets[pkey]._empty = false; metrics.forEach(m => { if (row[m.dataKey] != null) buckets[pkey][m.dataKey] += row[m.dataKey] }) }
  }
  return order.map(k => buckets[k])
}

const chartCard = { background: '#fff', border: '1px solid #EEF0F2', borderRadius: 14, padding: 16 }
const GRANS = [['day', '일', 'Day'], ['week', '주', 'Week'], ['month', '월', 'Month']]

// 지원 경로(application_source) 사람이 읽는 라벨 + 설명
const SOURCE_LABELS = {
  direct: { ko: '직접 지원', en: 'Direct', desc: { ko: '공고 페이지에서 바로 지원', en: 'Applied straight from the job page' } },
  salary: { ko: '급여 제출 후', en: 'After salary', desc: { ko: '연봉 제출 흐름에서 이어서 지원', en: 'After submitting salary' } },
  cv_success: { ko: 'CV 원탭 모달', en: 'CV one-tap', desc: { ko: 'CV 등록 후 추천 공고 원탭 지원', en: 'One-tap from CV modal' } },
  similar_after_apply: { ko: '지원 후 유사공고', en: 'Similar-after-apply', desc: { ko: '지원 완료 화면의 유사공고에서', en: 'From similar-jobs after applying' } },
  coldmail_jobs: { ko: '콜드메일 캠페인', en: 'Coldmail', desc: { ko: '콜드메일 원클릭 지원 링크', en: 'From coldmail quick-apply link' } },
}

export default function RevenueView({ token, lang }) {
  const ko = lang !== 'en'
  const { data, isLoading } = useAdmin('/api/admin/revenue-metrics', token)
  const [gran, setGran] = useState('day')

  if (isLoading || !data) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{ko ? '불러오는 중…' : 'Loading…'}</div>
  if (data.error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{data.error}</div>

  const { overview, daily = [], sourceBreakdown = [], platform = {} } = data
  const th = { textAlign: 'left', padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap' }
  const thR = { ...th, textAlign: 'right' }
  const td = { padding: '9px 12px', color: '#374151' }
  const tdR = { ...td, textAlign: 'right' }

  // 추이 — 기업 지원(녹) vs KTC 지원(보라). 같은 축(비중이 그대로 보이게 dualAxis 끔).
  const metrics = [
    { key: 'company', dataKey: 'company', label: ko ? '기업 지원' : 'Company', color: '#059669' },
    { key: 'ktc', dataKey: 'ktc', label: ko ? 'KTC 지원' : 'KTC', color: '#7C3AED' },
  ]
  const chartView = aggregateBy(daily, metrics, gran)
  const seriesTotal = (dk) => chartView.reduce((s, d) => s + (d[dk] || 0), 0)
  const grand = sourceBreakdown.reduce((s, r) => s + r.total, 0) || 1

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px' }}>{ko ? '이익 지원' : 'Revenue applications'}</h3>
        <div style={{ fontSize: 12.5, color: '#6B7280' }}>
          {ko ? '우리 이익이 남는 두 창구 — 기업 등록 공고 + KTC 시드 공고 — 에 들어온 지원. 멋사(내부) 제외.' : 'Applications to our two revenue channels — company-posted jobs + KTC seed jobs.'}
        </div>
      </div>

      {/* 이익 지원 카드 — 합계 / 기업 / KTC(+비중) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 26 }}>
        <div style={{ flex: '1 1 200px', background: '#FAFBFC', border: '1px solid #EEF0F2', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{overview.revenueApplications.toLocaleString()}</div>
          <div style={{ fontSize: 12.5, color: '#374151', fontWeight: 600, marginTop: 4 }}>{ko ? '이익 지원 합계' : 'Total revenue apps'}</div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{ko ? `기업 ${overview.applications} + KTC ${overview.ktcApplications}` : `Company ${overview.applications} + KTC ${overview.ktcApplications}`}</div>
        </div>
        <div style={{ flex: '1 1 200px', background: '#FAFBFC', border: '1px solid #EEF0F2', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{overview.applications.toLocaleString()}<span style={{ fontSize: 13, fontWeight: 600, color: '#9CA3AF' }}> · {(100 - overview.ktcShare).toFixed(1)}%</span></div>
          <div style={{ fontSize: 12.5, color: '#374151', fontWeight: 600, marginTop: 4 }}>{ko ? '기업 등록 공고 지원' : 'Company job apps'}</div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{ko ? `활성 기업 공고 ${overview.companyJobsActive}건` : `${overview.companyJobsActive} live company jobs`}</div>
        </div>
        <div style={{ flex: '1 1 200px', background: '#F6F2FE', border: '1px solid #E4D8FB', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#6D28D9', lineHeight: 1 }}>{overview.ktcApplications.toLocaleString()}<span style={{ fontSize: 13, fontWeight: 600, color: '#A78BDA' }}> · {overview.ktcShare.toFixed(1)}%</span></div>
          <div style={{ fontSize: 12.5, color: '#4C1D95', fontWeight: 600, marginTop: 4 }}>{ko ? 'KTC 공고 지원' : 'KTC job apps'}</div>
          <div style={{ fontSize: 11, color: '#8B7BB0', marginTop: 2 }}>{ko ? `활성 KTC 공고 ${overview.ktcJobsActive}건` : `${overview.ktcJobsActive} live KTC jobs`}</div>
        </div>
      </div>

      {/* 추이 — 기업 vs KTC, 일/주/월 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '0 0 4px' }}>
        <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{ko ? '지원 추이' : 'Trend'}</h4>
        <div style={{ display: 'flex', gap: 2, background: '#F2F4F6', borderRadius: 9, padding: 3 }}>
          {GRANS.map(([k, ko_, en]) => (
            <button key={k} onClick={() => setGran(k)} style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: gran === k ? '#fff' : 'transparent', color: gran === k ? '#7C3AED' : '#86868b',
              boxShadow: gran === k ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            }}>{ko ? ko_ : en}</button>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
        {`${ko ? (gran === 'day' ? '최근 30일' : gran === 'week' ? '주별(최근 12주)' : '월별(최근 6개월)') : (gran === 'day' ? 'Last 30 days' : gran === 'week' ? 'Weekly (12w)' : 'Monthly (6mo)')} · ${metrics.map(m => `${m.label} ${seriesTotal(m.dataKey).toLocaleString()}`).join(' · ')}`}
      </div>
      <div style={{ ...chartCard, marginBottom: 30 }}>
        <MetricChart daily={chartView} metrics={metrics} lang={lang} dualAxis={false} lineType={gran === 'day' ? 'linear' : 'monotone'} dots={gran !== 'day'} avgLabel={ko ? '평균' : 'avg'} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 8, fontSize: 12, color: '#6B7280' }}>
          {metrics.map(m => (
            <span key={m.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: m.color }} />{m.label}
            </span>
          ))}
        </div>
      </div>

      {/* 지원 경로 — 이익 지원이 어떤 경로로 들어왔는지 */}
      <h4 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px' }}>{ko ? '지원 경로' : 'Application source'}</h4>
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
        {ko ? '이익 지원(기업+KTC)이 각각 어떤 경로로 들어왔는지 — 유입 경로별 분해.' : 'How each revenue application arrived.'}
      </div>
      <div style={{ border: '1px solid #E5E8EB', borderRadius: 12, overflow: 'hidden', marginBottom: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F8FAFC', color: '#475569' }}>
              <th style={th}>{ko ? '경로' : 'Source'}</th>
              <th style={thR}>{ko ? '기업' : 'Company'}</th>
              <th style={thR}>KTC</th>
              <th style={thR}>{ko ? '합계' : 'Total'}</th>
              <th style={{ ...th, width: '34%' }}>{ko ? '비중' : 'Share'}</th>
            </tr>
          </thead>
          <tbody>
            {sourceBreakdown.length === 0 && (
              <tr><td style={{ ...td, textAlign: 'center', color: '#9CA3AF' }} colSpan={5}>{ko ? '데이터 없음' : 'No data'}</td></tr>
            )}
            {sourceBreakdown.map(r => {
              const lbl = SOURCE_LABELS[r.key]
              const pct = Math.round((r.total / grand) * 1000) / 10
              return (
                <tr key={r.key} style={{ borderTop: '1px solid #F1F5F9' }}>
                  <td style={td}>
                    <div style={{ fontWeight: 600, color: '#0F172A' }}>{lbl ? (ko ? lbl.ko : lbl.en) : r.key}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{lbl ? (ko ? lbl.desc.ko : lbl.desc.en) : r.key}</div>
                  </td>
                  <td style={tdR}>{r.company}</td>
                  <td style={{ ...tdR, color: '#6D28D9' }}>{r.ktc}</td>
                  <td style={{ ...tdR, fontWeight: 700, color: '#0F172A' }}>{r.total}</td>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 8, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: '#7C3AED', borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: 11.5, color: '#6B7280', width: 42, textAlign: 'right' }}>{pct}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 12, color: '#6B7280' }}>
        {ko ? '플랫폼' : 'Platform'}: <b style={{ color: '#374151' }}>web {platform.web || 0}</b> · <b style={{ color: '#374151' }}>app {platform.app || 0}</b> · {ko ? '미기록' : 'unknown'} {platform.unknown || 0}
      </div>
    </div>
  )
}
