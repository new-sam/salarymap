import { useState, useEffect } from 'react'
import Head from 'next/head'
import dynamic from 'next/dynamic'
import { supabase } from '../../lib/supabaseClient'

const MetricChart = dynamic(() => import('../../components/DashboardCharts'), { ssr: false })

const T = {
  ko: {
    title: '성과 대시보드',
    loading: '로딩 중...',
    denied: '접근 권한이 없습니다',
    loadingData: '데이터 불러오는 중...',
    refresh: '새로고침',
    lastUpdate: '마지막 업데이트',
    backTitle: '관리자로 돌아가기',
    trend: '추이',
    intentTitle: '관심도 분포',
    topCompanies: '상위 회사',
    countUnit: '개',
    dailyDetail: '일별 상세',
    total: '합계',
    expTitle: '실험 / 개선 기록',
    expAdd: '+ 추가',
    expCancel: '취소',
    expStartDate: '실험 시작일',
    expPlaceholder: '예: CTA 문구 변경, 랜딩 리디자인...',
    expSave: '저장',
    expDelete: '삭제',
    expDeleteConfirm: '이 실험 기록을 삭제하시겠습니까?',
    expEmpty: '아직 기록이 없습니다. 실험이나 개선 사항을 추가해보세요.',
    avg: '평균',
    tableHeaders: ['날짜', '전체', '광고', '자연유입', '가입', '회사', '채용지원'],
    metrics: {
      submissions: '제출', ad: '광고 (UTM)', organic: '자연유입',
      signups: '가입', jobApps: '채용지원', companies: '회사',
    },
  },
  en: {
    title: 'Performance Dashboard',
    loading: 'Loading...',
    denied: 'Access denied',
    loadingData: 'Loading data...',
    refresh: 'Refresh',
    lastUpdate: 'Last updated',
    backTitle: 'Back to Admin',
    trend: 'Trend',
    intentTitle: 'Intent Breakdown',
    topCompanies: 'Top Companies',
    countUnit: '',
    dailyDetail: 'Daily Detail',
    total: 'Total',
    expTitle: 'Experiments / Improvements',
    expAdd: '+ Add',
    expCancel: 'Cancel',
    expStartDate: 'Start date',
    expPlaceholder: 'e.g. CTA copy change, landing redesign...',
    expSave: 'Save',
    expDelete: 'Delete',
    expDeleteConfirm: 'Delete this experiment?',
    expEmpty: 'No records yet. Add an experiment or improvement.',
    avg: 'avg',
    tableHeaders: ['Date', 'Total', 'Ad', 'Organic', 'Sign-ups', 'Companies', 'Job Apps'],
    metrics: {
      submissions: 'Submissions', ad: 'Ad (UTM)', organic: 'Organic',
      signups: 'Sign-ups', jobApps: 'Job Apps', companies: 'Companies',
    },
  },
}

const METRICS_BASE = [
  { key: 'submissions', dataKey: 'submissions', color: '#111', summaryKey: 'totalSubmissions' },
  { key: 'ad', dataKey: 'ad', color: '#4F46E5', summaryKey: 'adSubmissions' },
  { key: 'organic', dataKey: 'organic', color: '#10B981', summaryKey: 'organicSubmissions' },
  { key: 'signups', dataKey: 'signups', color: '#F59E0B', summaryKey: 'totalSignups' },
  { key: 'jobApps', dataKey: 'jobApps', color: '#EF4444', summaryKey: 'totalJobApps' },
  { key: 'companies', dataKey: 'companies', color: '#8B5CF6', summaryKey: 'uniqueCompanies' },
]

const EXP_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F']

function getDoD(daily, dataKey) {
  if (!daily || daily.length < 2) return null
  const last = daily[daily.length - 1][dataKey]
  const prev = daily[daily.length - 2][dataKey]
  if (prev === 0) return last > 0 ? 100 : 0
  return Math.round(((last - prev) / prev) * 100)
}

export default function AdminDashboard() {
  const [auth, setAuth] = useState('loading')
  const [token, setToken] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [experiments, setExperiments] = useState([])
  const [expForm, setExpForm] = useState({ title: '', date: '', color: EXP_COLORS[0] })
  const [showExpForm, setShowExpForm] = useState(false)
  const [lang, setLang] = useState('ko')
  const [dateRange, setDateRange] = useState(() => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    return { from: '2026-04-20', to: yesterday }
  })

  const t = T[lang]
  const METRICS = METRICS_BASE.map(m => ({ ...m, label: t.metrics[m.key] }))

  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` })

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setAuth('denied'); return }
      try {
        const res = await fetch(`/api/admin/check?email=${encodeURIComponent(session.user.email)}`)
        const { isAdmin } = await res.json()
        if (!isAdmin) { setAuth('denied'); return }
        setToken(session.access_token)
        setAuth('ok')
      } catch {
        setAuth('denied')
      }
    })
  }, [])

  useEffect(() => {
    if (auth !== 'ok' || !token) return
    fetchData()
    fetchExperiments()
  }, [auth, token, dateRange, lang])

  async function fetchData() {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/admin/dashboard?from=${dateRange.from}&to=${dateRange.to}&lang=${lang}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const json = await res.json()
      setData(json)
      setLastUpdated(new Date())
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  async function fetchExperiments() {
    try {
      const res = await fetch('/api/admin/experiments', { headers: headers() })
      if (res.ok) setExperiments(await res.json())
    } catch (e) {
      console.error(e)
    }
  }

  async function addExperiment() {
    if (!expForm.title || !expForm.date) return
    const res = await fetch('/api/admin/experiments', {
      method: 'POST', headers: headers(), body: JSON.stringify(expForm)
    })
    if (res.ok) {
      setExpForm({ title: '', date: '', color: EXP_COLORS[experiments.length % EXP_COLORS.length] })
      setShowExpForm(false)
      fetchExperiments()
    }
  }

  async function deleteExperiment(id) {
    if (!confirm(t.expDeleteConfirm)) return
    await fetch('/api/admin/experiments', {
      method: 'DELETE', headers: headers(), body: JSON.stringify({ id })
    })
    fetchExperiments()
  }

  if (auth === 'loading') return <div style={{ padding: 40, textAlign: 'center' }}>{t.loading}</div>
  if (auth === 'denied') return <div style={{ padding: 40, textAlign: 'center' }}>{t.denied}</div>

  const selectedMetric = METRICS.find(m => m.key === selected)
  const visibleExperiments = experiments.filter(e => e.date >= dateRange.from && e.date <= dateRange.to)

  return (
    <>
      <Head><title>FYI {t.title}</title></Head>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href="/admin/jobs" style={{ color: '#888', textDecoration: 'none', fontSize: 20 }} title={t.backTitle}>&larr;</a>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{t.title}</h1>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="date" value={dateRange.from}
              onChange={e => setDateRange(r => ({ ...r, from: e.target.value }))}
              style={inputStyle} />
            <span style={{ color: '#666' }}>~</span>
            <input type="date" value={dateRange.to}
              onChange={e => setDateRange(r => ({ ...r, to: e.target.value }))}
              style={inputStyle} />
            <button onClick={fetchData} disabled={loading}
              style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              {loading ? '...' : t.refresh}
            </button>
          </div>
          {lastUpdated && (
            <div style={{ fontSize: 11, color: '#aaa', textAlign: 'right', marginTop: 4 }}>
              {t.lastUpdate}: {lastUpdated.toLocaleTimeString(lang === 'ko' ? 'ko-KR' : 'en-US')}
            </div>
          )}
        </div>

        {loading && <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{t.loadingData}</div>}

        {data && !loading && (
          <>
            {/* Clickable Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 24 }}>
              {METRICS.map(m => {
                const value = data.summary[m.summaryKey]
                const dod = getDoD(data.daily, m.dataKey)
                const isActive = selected === m.key
                return (
                  <div key={m.key}
                    onClick={() => setSelected(isActive ? null : m.key)}
                    style={{
                      background: isActive ? m.color : '#fff',
                      border: `2px solid ${isActive ? m.color : '#e5e7eb'}`,
                      borderRadius: 12, padding: '16px 20px', cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}>
                    <div style={{ fontSize: 12, color: isActive ? 'rgba(255,255,255,0.7)' : '#6B7280', marginBottom: 4 }}>{m.label}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <div style={{ fontSize: 28, fontWeight: 700, color: isActive ? '#fff' : m.color }}>{value}</div>
                      {dod !== null && (
                        <span style={{
                          fontSize: 13, fontWeight: 600,
                          color: isActive
                            ? 'rgba(255,255,255,0.8)'
                            : dod > 0 ? '#EF4444' : dod < 0 ? '#3B82F6' : '#9CA3AF'
                        }}>
                          {dod > 0 ? '+' : ''}{dod}%
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Selected Metric Chart + Experiment Chips */}
            {selectedMetric && (
              <div style={sectionStyle}>
                <h3 style={{ ...sectionTitle, marginBottom: 16 }}>{selectedMetric.label} {t.trend}</h3>
                <MetricChart daily={data.daily} metric={selectedMetric} experiments={visibleExperiments} avgLabel={t.avg} />

                {visibleExperiments.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
                    {visibleExperiments.map(exp => (
                      <div key={exp.id} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                        background: exp.color + '18', border: `1px solid ${exp.color}40`, color: '#333',
                      }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: exp.color, flexShrink: 0 }} />
                        <span style={{ color: '#888', fontSize: 11 }}>{exp.date.slice(5)}</span>
                        {exp.title}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Experiment Management */}
            <div style={sectionStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showExpForm || experiments.length > 0 ? 16 : 0 }}>
                <h3 style={{ ...sectionTitle, margin: 0 }}>{t.expTitle}</h3>
                <button onClick={() => setShowExpForm(!showExpForm)}
                  style={{ padding: '5px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, background: showExpForm ? '#f3f4f6' : '#fff', cursor: 'pointer', fontWeight: 600 }}>
                  {showExpForm ? t.expCancel : t.expAdd}
                </button>
              </div>

              {showExpForm && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 8 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, color: '#888' }}>
                    {t.expStartDate}
                    <input type="date" value={expForm.date}
                      onChange={e => setExpForm(f => ({ ...f, date: e.target.value }))}
                      style={{ ...inputStyle, width: 140 }} />
                  </label>
                  <input type="text" value={expForm.title} placeholder={t.expPlaceholder}
                    onChange={e => setExpForm(f => ({ ...f, title: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addExperiment()}
                    style={{ ...inputStyle, flex: 1 }} />
                  <div style={{ display: 'flex', gap: 4 }}>
                    {EXP_COLORS.map(c => (
                      <div key={c} onClick={() => setExpForm(f => ({ ...f, color: c }))}
                        style={{
                          width: 20, height: 20, borderRadius: '50%', background: c, cursor: 'pointer',
                          border: expForm.color === c ? '2px solid #333' : '2px solid transparent',
                        }} />
                    ))}
                  </div>
                  <button onClick={addExperiment}
                    style={{ padding: '6px 16px', border: 'none', borderRadius: 6, fontSize: 13, background: '#111', color: '#fff', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {t.expSave}
                  </button>
                </div>
              )}

              {experiments.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {experiments.map(exp => (
                    <div key={exp.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px', borderRadius: 8, background: '#fafafa', fontSize: 13,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: exp.color, flexShrink: 0 }} />
                        <span style={{ color: '#888', fontSize: 12, minWidth: 80 }}>{exp.date}</span>
                        <span style={{ fontWeight: 500 }}>{exp.title}</span>
                      </div>
                      <button onClick={() => deleteExperiment(exp.id)}
                        style={{ border: 'none', background: 'none', color: '#ccc', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}
                        title={t.expDelete}>
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {experiments.length === 0 && !showExpForm && (
                <div style={{ color: '#aaa', fontSize: 13, marginTop: 8 }}>
                  {t.expEmpty}
                </div>
              )}
            </div>

            {/* Intent & Top Companies */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
              <div style={sectionStyle}>
                <h3 style={sectionTitle}>{t.intentTitle}</h3>
                {data.intent.filter(i => i.value > 0).map((item, i) => {
                  const maxVal = Math.max(...data.intent.filter(x => x.value > 0).map(x => x.value))
                  return (
                    <div key={i} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 2 }}>
                        <span>{item.name}</span>
                        <span style={{ fontWeight: 600 }}>{item.value} ({item.pct}%)</span>
                      </div>
                      <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(item.value / maxVal) * 100}%`, background: COLORS[i % COLORS.length], borderRadius: 4 }} />
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={sectionStyle}>
                <h3 style={sectionTitle}>{t.topCompanies} ({data.summary.uniqueCompanies}{t.countUnit})</h3>
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  {data.topCompanies.map((c, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f3f3f3', fontSize: 13 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: '#999', width: 20, textAlign: 'right', fontSize: 11 }}>{i + 1}</span>
                        {c.name}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: Math.max(4, (c.count / data.topCompanies[0].count) * 100), height: 16, background: '#4F46E5', borderRadius: 3, opacity: 0.7 }} />
                        <span style={{ fontWeight: 600, minWidth: 24, textAlign: 'right' }}>{c.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Daily Detail Table */}
            <div style={sectionStyle}>
              <h3 style={sectionTitle}>{t.dailyDetail}</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                      {t.tableHeaders.map((h, i) => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: i === 0 ? 'left' : 'right', fontWeight: 600, color: '#374151' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.daily.map((d, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '6px 12px' }}>{d.date}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>{d.submissions}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: '#4F46E5' }}>{d.ad}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: '#10B981' }}>{d.organic}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: '#F59E0B' }}>{d.signups}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: '#8B5CF6' }}>{d.companies}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: '#EF4444' }}>{d.jobApps}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: '2px solid #e5e7eb', fontWeight: 700 }}>
                      <td style={{ padding: '8px 12px' }}>{t.total}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>{data.summary.totalSubmissions}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#4F46E5' }}>{data.summary.adSubmissions}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#10B981' }}>{data.summary.organicSubmissions}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#F59E0B' }}>{data.summary.totalSignups}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#8B5CF6' }}>{data.summary.uniqueCompanies}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#EF4444' }}>{data.summary.totalJobApps}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Language Switcher */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '16px 0', borderTop: '1px solid #f3f4f6' }}>
          {['ko', 'en'].map(l => (
            <button key={l} onClick={() => setLang(l)}
              style={{
                padding: '4px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: lang === l ? '1px solid #111' : '1px solid #d1d5db',
                background: lang === l ? '#111' : '#fff',
                color: lang === l ? '#fff' : '#666',
              }}>
              {l === 'ko' ? '한국어' : 'English'}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#6B7280']

const inputStyle = {
  padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13,
}

const sectionStyle = {
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 24,
}

const sectionTitle = {
  fontSize: 16, fontWeight: 600, margin: '0 0 16px 0',
}
