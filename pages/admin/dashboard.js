import { useState, useEffect } from 'react'
import Head from 'next/head'
import dynamic from 'next/dynamic'
import { supabase } from '../../lib/supabaseClient'
import Icon from '../../components/Icon'
import FunnelView from '../../components/admin/FunnelView'
import UtmView from '../../components/admin/UtmView'
import UsersView from '../../components/admin/UsersView'
import ApplicationsView from '../../components/admin/ApplicationsView'
import {
  T, METRICS_BASE, EXP_COLORS, COLORS,
  inputStyle, sectionStyle, sectionTitle,
} from '../../constants/dashboard'
import { getDoD, aggregateDaily, localDate } from '../../utils/dashboard'

const MetricChart = dynamic(() => import('../../components/DashboardCharts'), { ssr: false })

export default function AdminDashboard() {
  const [auth, setAuth] = useState('loading')
  const [token, setToken] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [experiments, setExperiments] = useState([])
  const [expForm, setExpForm] = useState({ title: '', date: '', color: EXP_COLORS[0], metrics: [] })
  const [showExpForm, setShowExpForm] = useState(false)
  const [lang, setLang] = useState('ko')
  const [tab, setTab] = useState('trend')
  const [funnelKeys, setFunnelKeys] = useState([])
  const [chartMode, setChartMode] = useState('1d')
  const [realtime, setRealtime] = useState(null)
  const [realtimeLoading, setRealtimeLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const yesterday = (() => {
    const d = new Date(Date.now() - 86400000)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()
  const [dateInput, setDateInput] = useState({ from: '2026-04-20', to: yesterday })
  const [dateRange, setDateRange] = useState({ from: '2026-04-20', to: yesterday })

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
    fetchRealtime()
  }, [auth, token, dateRange, lang])

  useEffect(() => {
    if (!autoRefresh || auth !== 'ok' || !token) return
    const id = setInterval(fetchRealtime, 30000)
    return () => clearInterval(id)
  }, [autoRefresh, auth, token])

  function applyRange(from, to) {
    setDateInput({ from, to })
    setDateRange({ from, to })
  }

  function applyPreset(days) {
    const to = localDate(Date.now() - 86400000)
    const from = localDate(Date.now() - days * 86400000)
    applyRange(from, to)
  }

  function handleSearch() {
    setDateRange({ ...dateInput })
  }

  async function fetchData() {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/admin/dashboard?from=${dateRange.from}&to=${dateRange.to}&lang=${lang}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const json = await res.json()
      if (json.error) { console.error('Dashboard API error:', json.error); setLoading(false); return }
      setData(json)
      setLastUpdated(new Date())
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  async function fetchRealtime() {
    setRealtimeLoading(true)
    try {
      const res = await fetch('/api/admin/realtime', { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        setRealtime(await res.json())
        setLastUpdated(new Date())
      }
    } catch (e) {
      console.error(e)
    }
    setRealtimeLoading(false)
  }

  async function fetchExperiments() {
    try {
      const res = await fetch('/api/admin/experiments', { headers: headers() })
      if (res.ok) setExperiments(await res.json())
    } catch (e) {
      console.error(e)
    }
  }

  const [editingExp, setEditingExp] = useState(null)

  async function addExperiment() {
    if (!expForm.title || !expForm.date) return
    const res = await fetch('/api/admin/experiments', {
      method: 'POST', headers: headers(), body: JSON.stringify(expForm)
    })
    if (res.ok) {
      setExpForm({ title: '', date: '', color: EXP_COLORS[experiments.length % EXP_COLORS.length], metrics: [] })
      setShowExpForm(false)
      fetchExperiments()
    }
  }

  async function updateExperiment() {
    if (!editingExp || !editingExp.title || !editingExp.date) return
    const res = await fetch('/api/admin/experiments', {
      method: 'PUT', headers: headers(), body: JSON.stringify(editingExp)
    })
    if (res.ok) {
      setEditingExp(null)
      fetchExperiments()
    }
  }

  async function deleteExperiment(id) {
    if (!confirm(t.expDeleteConfirm)) return
    await fetch('/api/admin/experiments', {
      method: 'DELETE', headers: headers(), body: JSON.stringify({ id })
    })
    setEditingExp(null)
    fetchExperiments()
  }

  if (auth === 'loading') return <div style={{ padding: 40, textAlign: 'center' }}>{t.loading}</div>
  if (auth === 'denied') return <div style={{ padding: 40, textAlign: 'center' }}>{t.denied}</div>

  const selectedMetric = METRICS.find(m => m.key === selected)

  const dailyWithToday = (() => {
    if (!data?.daily || !realtime) return data?.daily
    const today = realtime.date
    if (today > dateRange.to && today !== localDate(Date.now())) return data.daily
    const todayData = {
      date: today,
      submissions: realtime.submissions,
      ad: realtime.ad,
      organic: realtime.organic,
      signups: realtime.signups,
      companies: 0,
      jobClicks: realtime.jobClicks,
      cardClicks: realtime.cardClicks,
      jobApps: realtime.jobApps,
    }
    const exists = data.daily.some(d => d.date === today)
    if (exists) return data.daily.map(d => d.date === today ? todayData : d)
    return [...data.daily, todayData]
  })()

  const summary = (() => {
    if (!data?.summary || !realtime) return data?.summary
    const today = realtime.date
    const todayInRange = data.daily?.find(d => d.date === today)
    if (!todayInRange && today > dateRange.to) return data.summary
    const diff = (rtKey, dayKey) => (realtime[rtKey] ?? 0) - (todayInRange?.[dayKey ?? rtKey] ?? 0)
    return {
      ...data.summary,
      totalSubmissions: data.summary.totalSubmissions + diff('submissions'),
      adSubmissions: data.summary.adSubmissions + diff('ad'),
      organicSubmissions: data.summary.organicSubmissions + diff('organic'),
      totalSignups: data.summary.totalSignups + diff('signups'),
      totalJobApps: data.summary.totalJobApps + diff('jobApps'),
      totalJobClicks: data.summary.totalJobClicks + diff('jobClicks'),
      totalCardClicks: data.summary.totalCardClicks + diff('cardClicks'),
    }
  })()

  const chartData = aggregateDaily(dailyWithToday, chartMode)
  const visibleExperiments = experiments.filter(e => e.date >= dateRange.from && e.date <= (realtime?.date || dateRange.to) && (!e.metrics?.length || !selected || e.metrics.includes(selected)))

  return (
    <>
      <Head><title>FYI {t.title}</title></Head>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href="/admin/jobs" style={{ color: '#888', textDecoration: 'none', fontSize: 20 }} title={t.backTitle}>&larr;</a>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{t.title}</h1>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {[{ label: '7D', days: 7 }, { label: '14D', days: 14 }, { label: '30D', days: 30 }, { label: 'All', days: 0 }].map(p => (
              <button key={p.label} onClick={() => p.days ? applyPreset(p.days) : applyRange('2026-04-20', yesterday)}
                style={{ padding: '5px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                {p.label}
              </button>
            ))}
            <span style={{ color: '#ddd', margin: '0 2px' }}>|</span>
            <input type="date" value={dateInput.from}
              onChange={e => setDateInput(r => ({ ...r, from: e.target.value }))}
              style={inputStyle} />
            <span style={{ color: '#666' }}>~</span>
            <input type="date" value={dateInput.to}
              onChange={e => setDateInput(r => ({ ...r, to: e.target.value }))}
              style={inputStyle} />
            <button onClick={handleSearch} disabled={loading}
              style={{ padding: '6px 14px', border: 'none', borderRadius: 6, fontSize: 13, background: '#111', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              {loading ? '...' : lang === 'ko' ? '조회' : 'Search'}
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '2px solid #e5e7eb' }}>
          {['trend', 'funnel', 'utm', 'users', 'applications'].map(k => (
            <button key={k} onClick={() => setTab(k)}
              style={{
                padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                border: 'none', borderBottom: tab === k ? '2px solid #111' : '2px solid transparent',
                background: 'none', color: tab === k ? '#111' : '#999',
                marginBottom: -2, transition: 'all 0.15s',
              }}>
              {t[k]}
            </button>
          ))}
        </div>

        {/* Today Realtime */}
        {realtime && (
          <div style={{
            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
            borderRadius: 12, padding: '16px 20px', marginBottom: 24, color: '#fff',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', background: '#34d399',
                  display: 'inline-block', animation: autoRefresh ? 'pulse 2s infinite' : 'none',
                }} />
                <span style={{ fontSize: 14, fontWeight: 700 }}>{t.today}</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{realtime.date}</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginLeft: 4 }}>UTC+7</span>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {lastUpdated && (
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                    {new Date(lastUpdated.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(11, 16)} (VN)
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8 }}>
              {[
                { label: t.metrics.submissions, value: realtime.submissions, color: '#e2e8f0' },
                { label: t.metrics.ad, value: realtime.ad, color: '#818cf8' },
                { label: t.metrics.organic, value: realtime.organic, color: '#34d399' },
                { label: t.metrics.signups, value: realtime.signups, color: '#fbbf24' },
                { label: t.pageViews, value: realtime.landings, color: '#a78bfa' },
                { label: t.metrics.jobClicks, value: realtime.jobClicks, color: '#fb923c' },
                { label: t.metrics.cardClicks, value: realtime.cardClicks, color: '#f472b6' },
                { label: t.metrics.jobApps, value: realtime.jobApps, color: '#f87171' },
              ].map(item => (
                <div key={item.label} style={{
                  background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 12px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <style jsx global>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        `}</style>

        {loading && <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{t.loadingData}</div>}

        {/* Trend Tab */}
        {summary && !loading && tab === 'trend' && (
          <>
            {/* Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 24 }}>
              {METRICS.map(m => {
                const isEventMetric = m.key === 'jobClicks' || m.key === 'cardClicks'
                const noTracking = isEventMetric && !summary.hasEventTracking
                const value = noTracking ? '-' : summary[m.summaryKey]
                const dod = noTracking ? null : getDoD(chartData, m.dataKey)
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

            {/* Chart */}
            {selectedMetric && (
              <div style={sectionStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ ...sectionTitle, margin: 0 }}>{selectedMetric.label} {t.trend}</h3>
                  <div style={{ display: 'flex', gap: 0, background: '#f3f4f6', borderRadius: 8, padding: 2 }}>
                    {[
                      { key: '1d', label: t.chart1d },
                      { key: '3d', label: t.chart3d },
                      { key: 'weekly', label: t.chartWeekly },
                      { key: 'monthly', label: t.chartMonthly },
                    ].map(m => (
                      <button key={m.key} onClick={() => setChartMode(m.key)}
                        style={{
                          padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                          border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                          background: chartMode === m.key ? '#fff' : 'transparent',
                          color: chartMode === m.key ? '#111' : '#999',
                          boxShadow: chartMode === m.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        }}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                <MetricChart daily={chartData} metric={selectedMetric} experiments={chartMode === '1d' ? visibleExperiments : []} avgLabel={t.avg} lang={lang} />

                {visibleExperiments.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
                    {visibleExperiments.map((exp, i) => (
                      <div key={exp.id} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                        background: exp.color + '18', border: `1px solid ${exp.color}40`, color: '#333',
                      }}>
                        <span style={{
                          width: 16, height: 16, borderRadius: '50%', background: exp.color, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: 1,
                        }}>{i + 1}</span>
                        <span style={{ color: '#888', fontSize: 11 }}>{exp.date.slice(5)}</span>
                        {exp.title}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Experiments */}
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
                  <div style={{ width: '100%', marginTop: 8 }}>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{lang === 'ko' ? '영향 지표' : 'Affected Metrics'}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {METRICS_BASE.map(m => {
                        const on = expForm.metrics.includes(m.key)
                        return (
                          <button key={m.key} onClick={() => setExpForm(f => ({ ...f, metrics: on ? f.metrics.filter(k => k !== m.key) : [...f.metrics, m.key] }))}
                            style={{ padding: '3px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600, border: on ? `1.5px solid ${m.color}` : '1px solid #ddd', background: on ? m.color + '18' : '#fff', color: on ? m.color : '#999', cursor: 'pointer' }}>
                            {t.metrics[m.key] || m.key}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {experiments.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {experiments.map(exp => {
                    const isEditing = editingExp?.id === exp.id
                    if (isEditing) return (
                      <div key={exp.id} style={{ padding: 12, borderRadius: 8, background: '#f0f0ff', border: `1.5px solid #4F46E5`, fontSize: 13 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                          <input type="date" value={editingExp.date} onChange={e => setEditingExp(f => ({ ...f, date: e.target.value }))}
                            style={{ ...inputStyle, width: 140 }} />
                          <input type="text" value={editingExp.title} onChange={e => setEditingExp(f => ({ ...f, title: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && updateExperiment()}
                            style={{ ...inputStyle, flex: 1 }} />
                          <div style={{ display: 'flex', gap: 3 }}>
                            {EXP_COLORS.map(c => (
                              <div key={c} onClick={() => setEditingExp(f => ({ ...f, color: c }))}
                                style={{ width: 18, height: 18, borderRadius: '50%', background: c, cursor: 'pointer', border: editingExp.color === c ? '2px solid #333' : '2px solid transparent' }} />
                            ))}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                          {METRICS_BASE.map(m => {
                            const on = (editingExp.metrics || []).includes(m.key)
                            return (
                              <button key={m.key} onClick={() => setEditingExp(f => ({ ...f, metrics: on ? (f.metrics || []).filter(k => k !== m.key) : [...(f.metrics || []), m.key] }))}
                                style={{ padding: '3px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600, border: on ? `1.5px solid ${m.color}` : '1px solid #ddd', background: on ? m.color + '18' : '#fff', color: on ? m.color : '#999', cursor: 'pointer' }}>
                                {t.metrics[m.key] || m.key}
                              </button>
                            )
                          })}
                        </div>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button onClick={() => setEditingExp(null)}
                            style={{ padding: '4px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, background: '#fff', cursor: 'pointer' }}>
                            {t.expCancel}
                          </button>
                          <button onClick={() => deleteExperiment(exp.id)}
                            style={{ padding: '4px 12px', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 12, background: '#fff', color: '#EF4444', cursor: 'pointer', fontWeight: 600 }}>
                            {t.expDelete}
                          </button>
                          <button onClick={updateExperiment}
                            style={{ padding: '4px 12px', border: 'none', borderRadius: 6, fontSize: 12, background: '#111', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                            {t.expSave}
                          </button>
                        </div>
                      </div>
                    )
                    return (
                    <div key={exp.id} onClick={() => setEditingExp({ ...exp, metrics: exp.metrics || [] })} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px', borderRadius: 8, background: '#fafafa', fontSize: 13, cursor: 'pointer',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: exp.color, flexShrink: 0 }} />
                        <span style={{ color: '#888', fontSize: 12, minWidth: 80 }}>{exp.date}</span>
                        <span style={{ fontWeight: 500 }}>{exp.title}</span>
                        {exp.metrics?.map(mk => {
                          const mb = METRICS_BASE.find(x => x.key === mk)
                          return mb ? <span key={mk} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: mb.color + '18', color: mb.color, fontWeight: 600 }}>{t.metrics[mk] || mk}</span> : null
                        })}
                      </div>
                      <Icon name="edit" size={11} color="#ccc" />
                    </div>
                    )
                  })}
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
                <h3 style={sectionTitle}>{t.topCompanies} ({summary.uniqueCompanies}{t.countUnit})</h3>
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  {data.topCompanies.map((c, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f3f3f3', fontSize: 13 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: '#999', width: 20, textAlign: 'right', fontSize: 11 }}>{i + 1}</span>
                        {c.name}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: Math.max(4, (c.count / (data.topCompanies[0]?.count || 1)) * 100), height: 16, background: '#4F46E5', borderRadius: 3, opacity: 0.7 }} />
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
                    {dailyWithToday.map((d, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '6px 12px' }}>{d.date}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>{d.submissions}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: '#4F46E5' }}>{d.ad}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: '#10B981' }}>{d.organic}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: '#F59E0B' }}>{d.signups}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: '#8B5CF6' }}>{d.companies}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: d.jobClicks === null ? '#ccc' : '#F97316' }}>{d.jobClicks === null ? '-' : d.jobClicks}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: d.cardClicks === null ? '#ccc' : '#EC4899' }}>{d.cardClicks === null ? '-' : d.cardClicks}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: d.jobsPageViews === null ? '#ccc' : '#06B6D4' }}>{d.jobsPageViews === null ? '-' : d.jobsPageViews}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: d.applyClicks === null ? '#ccc' : '#D946EF' }}>{d.applyClicks === null ? '-' : d.applyClicks}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: d.saveClicks === null ? '#ccc' : '#F472B6' }}>{d.saveClicks === null ? '-' : d.saveClicks}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: '#EF4444' }}>{d.jobApps}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: '2px solid #e5e7eb', fontWeight: 700 }}>
                      <td style={{ padding: '8px 12px' }}>{t.total}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>{summary.totalSubmissions}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#4F46E5' }}>{summary.adSubmissions}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#10B981' }}>{summary.organicSubmissions}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#F59E0B' }}>{summary.totalSignups}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#8B5CF6' }}>{summary.uniqueCompanies}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: summary.hasEventTracking ? '#F97316' : '#ccc' }}>{summary.hasEventTracking ? summary.totalJobClicks : '-'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: summary.hasEventTracking ? '#EC4899' : '#ccc' }}>{summary.hasEventTracking ? summary.totalCardClicks : '-'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: summary.hasEventTracking ? '#06B6D4' : '#ccc' }}>{summary.hasEventTracking ? summary.totalJobsPageViews : '-'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: summary.hasEventTracking ? '#D946EF' : '#ccc' }}>{summary.hasEventTracking ? summary.totalApplyClicks : '-'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: summary.hasEventTracking ? '#F472B6' : '#ccc' }}>{summary.hasEventTracking ? summary.totalSaveClicks : '-'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#EF4444' }}>{summary.totalJobApps}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Funnel Tab */}
        {data?.summary && !loading && tab === 'funnel' && (
          <FunnelView data={data} metrics={METRICS} summary={summary} funnelKeys={funnelKeys} setFunnelKeys={setFunnelKeys} t={t} lang={lang} />
        )}

        {/* UTM Tab */}
        {data && !loading && tab === 'utm' && (
          <UtmView utm={data.utm} t={t} />
        )}

        {/* Users Tab */}
        {tab === 'users' && (
          <UsersView token={token} t={t} />
        )}

        {/* Applications Tab */}
        {tab === 'applications' && (
          <ApplicationsView token={token} t={t} />
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
