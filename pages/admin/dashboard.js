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
    lastUpdate: '마지막 업데이트',
    refresh: '새로고침',
    autoRefresh: '자동',
    today: '오늘 실시간',
    pageViews: '랜딩',
    chart1d: '1일',
    chart3d: '3일',
    chartWeekly: '주간',
    chartMonthly: '월간',
    backTitle: '관리자로 돌아가기',
    trend: '추이',
    funnel: '퍼널',
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
    tableHeaders: ['날짜', '전체', '광고', '자연유입', '가입', '회사', '공고클릭', '카드클릭', 'Jobs뷰', '상세뷰', 'Apply클릭', '채용지원'],
    metrics: {
      submissions: '제출', ad: '광고 (UTM)', organic: '자연유입',
      signups: '가입', jobClicks: '공고클릭', cardClicks: '카드클릭', jobApps: '채용지원', companies: '회사',
      jobsPageViews: 'Jobs뷰', jobDetailViews: '상세뷰', applyClicks: 'Apply클릭',
    },
    funnelEmpty: '스테이지를 클릭하여 퍼널을 구성하세요',
    funnelClear: '초기화',
    funnelOverall: '전체 전환율',
    funnelStep: 'Step',
    funnelDropped: '이탈',
    funnelOf: '전체 대비',
    funnelConv: '전환율',
    users: '가입자',
    usersTitle: '가입자 목록',
    usersTotal: '총 가입자',
    usersDownloadCsv: 'CSV 다운로드',
    usersEmail: '이메일',
    usersName: '이름',
    usersProvider: '가입 방법',
    usersCreatedAt: '가입일',
    usersLastSignIn: '마지막 로그인',
    usersLoading: '가입자 불러오는 중...',
    usersEmpty: '가입자가 없습니다.',
    utm: 'UTM',
    utmTitle: 'UTM 캠페인 분석',
    utmSource: '소스 (utm_source)',
    utmCampaign: '캠페인 (utm_campaign)',
    utmContent: '콘텐츠 (utm_content)',
    utmViews: '방문',
    utmSubmissions: '제출',
    utmConvRate: '전환율',
    utmTotalViews: '총 UTM 방문',
    utmNoData: 'UTM 데이터가 아직 없습니다. 캠페인 링크로 방문이 들어오면 여기에 표시됩니다.',
  },
  en: {
    title: 'Performance Dashboard',
    loading: 'Loading...',
    denied: 'Access denied',
    loadingData: 'Loading data...',
    lastUpdate: 'Last updated',
    refresh: 'Refresh',
    autoRefresh: 'Auto',
    today: 'Today Live',
    pageViews: 'Landings',
    chart1d: '1D',
    chart3d: '3D',
    chartWeekly: 'W',
    chartMonthly: 'M',
    backTitle: 'Back to Admin',
    trend: 'Trend',
    funnel: 'Funnel',
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
    tableHeaders: ['Date', 'Total', 'Ad', 'Organic', 'Sign-ups', 'Companies', 'Job Clicks', 'Card Clicks', 'Jobs Views', 'Detail Views', 'Apply Clicks', 'Job Apps'],
    metrics: {
      submissions: 'Submissions', ad: 'Ad (UTM)', organic: 'Organic',
      signups: 'Sign-ups', jobClicks: 'Job Clicks', cardClicks: 'Card Clicks', jobApps: 'Job Apps', companies: 'Companies',
      jobsPageViews: 'Jobs Views', jobDetailViews: 'Detail Views', applyClicks: 'Apply Clicks',
    },
    funnelEmpty: 'Click stages below to build your funnel',
    funnelClear: 'Clear',
    funnelOverall: 'Overall conversion',
    funnelStep: 'Step',
    funnelDropped: 'Dropped',
    funnelOf: 'of total',
    funnelConv: 'Conversion',
    users: 'Users',
    usersTitle: 'Sign-up Users',
    usersTotal: 'Total Users',
    usersDownloadCsv: 'Download CSV',
    usersEmail: 'Email',
    usersName: 'Name',
    usersProvider: 'Provider',
    usersCreatedAt: 'Signed Up',
    usersLastSignIn: 'Last Sign In',
    usersLoading: 'Loading users...',
    usersEmpty: 'No users found.',
    utm: 'UTM',
    utmTitle: 'UTM Campaign Analysis',
    utmSource: 'Source (utm_source)',
    utmCampaign: 'Campaign (utm_campaign)',
    utmContent: 'Content (utm_content)',
    utmViews: 'Views',
    utmSubmissions: 'Submissions',
    utmConvRate: 'Conv. Rate',
    utmTotalViews: 'Total UTM Views',
    utmNoData: 'No UTM data yet. Campaign visits will appear here.',
  },
}

const METRICS_BASE = [
  { key: 'submissions', dataKey: 'submissions', color: '#374151', summaryKey: 'totalSubmissions' },
  { key: 'ad', dataKey: 'ad', color: '#4F46E5', summaryKey: 'adSubmissions' },
  { key: 'organic', dataKey: 'organic', color: '#10B981', summaryKey: 'organicSubmissions' },
  { key: 'signups', dataKey: 'signups', color: '#F59E0B', summaryKey: 'totalSignups' },
  { key: 'jobClicks', dataKey: 'jobClicks', color: '#F97316', summaryKey: 'totalJobClicks' },
  { key: 'cardClicks', dataKey: 'cardClicks', color: '#EC4899', summaryKey: 'totalCardClicks' },
  { key: 'jobsPageViews', dataKey: 'jobsPageViews', color: '#06B6D4', summaryKey: 'totalJobsPageViews' },
  { key: 'jobDetailViews', dataKey: 'jobDetailViews', color: '#8B5CF6', summaryKey: 'totalJobDetailViews' },
  { key: 'applyClicks', dataKey: 'applyClicks', color: '#D946EF', summaryKey: 'totalApplyClicks' },
  { key: 'jobApps', dataKey: 'jobApps', color: '#EF4444', summaryKey: 'totalJobApps' },
  { key: 'companies', dataKey: 'companies', color: '#6B7280', summaryKey: 'uniqueCompanies' },
]

const EXP_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F']

function getDoD(daily, dataKey) {
  if (!daily || daily.length < 2) return null
  const last = daily[daily.length - 1][dataKey]
  const prev = daily[daily.length - 2][dataKey]
  if (last === null || last === undefined || prev === null || prev === undefined) return null
  if (prev === 0) return last > 0 ? 100 : 0
  return Math.round(((last - prev) / prev) * 100)
}

const DATA_KEYS = ['submissions', 'ad', 'organic', 'signups', 'companies', 'jobApps', 'jobClicks', 'cardClicks', 'jobsPageViews', 'jobDetailViews', 'applyClicks']

function aggregateDaily(daily, mode) {
  if (!daily || mode === '1d') return daily
  const buckets = {}
  const firstDate = daily.length > 0 ? new Date(daily[0].date) : new Date()
  for (const d of daily) {
    let key
    if (mode === '3d') {
      const dt = new Date(d.date)
      const diff = Math.floor((dt - firstDate) / (3 * 86400000))
      const bucket = new Date(firstDate.getTime() + diff * 3 * 86400000)
      key = bucket.toISOString().slice(0, 10)
    } else if (mode === 'weekly') {
      const dt = new Date(d.date)
      const day = dt.getDay()
      const mon = new Date(dt)
      mon.setDate(dt.getDate() - ((day + 6) % 7))
      key = mon.toISOString().slice(0, 10)
    } else {
      key = d.date.slice(0, 7)
    }
    if (!buckets[key]) buckets[key] = { date: key }
    for (const k of DATA_KEYS) {
      const val = d[k]
      if (val === null || val === undefined) continue
      buckets[key][k] = (buckets[key][k] || 0) + val
    }
  }
  return Object.values(buckets).sort((a, b) => a.date.localeCompare(b.date))
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
  const [tab, setTab] = useState('trend')
  const [funnelKeys, setFunnelKeys] = useState([])
  const [chartMode, setChartMode] = useState('1d')
  const [realtime, setRealtime] = useState(null)
  const [realtimeLoading, setRealtimeLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
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

  function localDate(ms) {
    const d = new Date(ms)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

  // Merge realtime (today) into daily for chart display
  const dailyWithToday = (() => {
    if (!data?.daily || !realtime) return data?.daily
    const today = realtime.date
    if (today > dateRange.to) return data.daily
    const exists = data.daily.some(d => d.date === today)
    if (exists) return data.daily
    return [...data.daily, {
      date: today,
      submissions: realtime.submissions,
      ad: realtime.ad,
      organic: realtime.organic,
      signups: realtime.signups,
      companies: 0,
      jobClicks: realtime.jobClicks,
      cardClicks: realtime.cardClicks,
      jobApps: realtime.jobApps,
    }]
  })()

  const chartData = aggregateDaily(dailyWithToday, chartMode)
  const visibleExperiments = experiments.filter(e => e.date >= dateRange.from && e.date <= (realtime?.date || dateRange.to))

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
          {['trend', 'funnel', 'utm', 'users'].map(k => (
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

        {/* ===== TODAY REALTIME ===== */}
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
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button onClick={() => setAutoRefresh(!autoRefresh)}
                  style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    border: autoRefresh ? '1px solid #34d399' : '1px solid rgba(255,255,255,0.3)',
                    background: autoRefresh ? 'rgba(52,211,153,0.2)' : 'transparent',
                    color: autoRefresh ? '#34d399' : 'rgba(255,255,255,0.6)',
                  }}>
                  {t.autoRefresh} {autoRefresh ? 'ON' : 'OFF'}
                </button>
                <button onClick={fetchRealtime} disabled={realtimeLoading}
                  style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', color: '#fff',
                  }}>
                  {realtimeLoading ? '...' : t.refresh}
                </button>
                {lastUpdated && (
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                    {lastUpdated.toLocaleTimeString(lang === 'ko' ? 'ko-KR' : 'en-US')}
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
                { label: t.pageViews, value: realtime.pageViews, color: '#a78bfa' },
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

        {/* ===== TREND TAB ===== */}
        {data?.summary && !loading && tab === 'trend' && (
          <>
            {/* Clickable Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 24 }}>
              {METRICS.map(m => {
                const isEventMetric = m.key === 'jobClicks' || m.key === 'cardClicks'
                const noTracking = isEventMetric && !data.summary.hasEventTracking
                const value = noTracking ? '-' : data.summary[m.summaryKey]
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

            {/* Selected Metric Chart + Experiment Chips */}
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
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: d.jobDetailViews === null ? '#ccc' : '#8B5CF6' }}>{d.jobDetailViews === null ? '-' : d.jobDetailViews}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: d.applyClicks === null ? '#ccc' : '#D946EF' }}>{d.applyClicks === null ? '-' : d.applyClicks}</td>
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
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: data.summary.hasEventTracking ? '#F97316' : '#ccc' }}>{data.summary.hasEventTracking ? data.summary.totalJobClicks : '-'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: data.summary.hasEventTracking ? '#EC4899' : '#ccc' }}>{data.summary.hasEventTracking ? data.summary.totalCardClicks : '-'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: data.summary.hasEventTracking ? '#06B6D4' : '#ccc' }}>{data.summary.hasEventTracking ? data.summary.totalJobsPageViews : '-'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: data.summary.hasEventTracking ? '#8B5CF6' : '#ccc' }}>{data.summary.hasEventTracking ? data.summary.totalJobDetailViews : '-'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: data.summary.hasEventTracking ? '#D946EF' : '#ccc' }}>{data.summary.hasEventTracking ? data.summary.totalApplyClicks : '-'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#EF4444' }}>{data.summary.totalJobApps}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ===== FUNNEL TAB ===== */}
        {data?.summary && !loading && tab === 'funnel' && (
          <FunnelView data={data} metrics={METRICS} funnelKeys={funnelKeys} setFunnelKeys={setFunnelKeys} t={t} lang={lang} />
        )}

        {/* ===== UTM TAB ===== */}
        {data && !loading && tab === 'utm' && (
          <UtmView utm={data.utm} t={t} />
        )}

        {/* ===== USERS TAB ===== */}
        {tab === 'users' && (
          <UsersView token={token} t={t} />
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

/* ──────────────── Amplitude-style Funnel ──────────────── */

const FUNNEL_TRACKING_START = '2026-05-09'

const PRESET_FUNNELS = {
  ko: [
    { name: 'Jobs 채용 퍼널', desc: 'Jobs 페이지 방문부터 지원 완료까지', keys: ['jobsPageViews', 'cardClicks', 'jobDetailViews', 'applyClicks', 'jobApps'], since: FUNNEL_TRACKING_START },
    { name: '홈 → Jobs 전환', desc: '홈페이지 유입부터 Jobs 관심까지', keys: ['submissions', 'jobClicks', 'jobsPageViews', 'cardClicks'], since: FUNNEL_TRACKING_START },
    { name: '가입 & 지원', desc: '제출 → 가입 → 지원 전환', keys: ['submissions', 'signups', 'applyClicks', 'jobApps'], since: FUNNEL_TRACKING_START },
  ],
  en: [
    { name: 'Jobs Hiring Funnel', desc: 'From page visit to application', keys: ['jobsPageViews', 'cardClicks', 'jobDetailViews', 'applyClicks', 'jobApps'], since: FUNNEL_TRACKING_START },
    { name: 'Home → Jobs Conversion', desc: 'Home traffic to Jobs interest', keys: ['submissions', 'jobClicks', 'jobsPageViews', 'cardClicks'], since: FUNNEL_TRACKING_START },
    { name: 'Signup & Apply', desc: 'Submit → Signup → Apply flow', keys: ['submissions', 'signups', 'applyClicks', 'jobApps'], since: FUNNEL_TRACKING_START },
  ],
}

function sumDailyFrom(daily, keys, since) {
  const filtered = daily.filter(d => d.date >= since)
  const sums = {}
  for (const k of keys) {
    sums[k] = filtered.reduce((acc, d) => acc + (d[k] || 0), 0)
  }
  return sums
}

const MAX_BAR_HEIGHT = 160

function FunnelView({ data, metrics, funnelKeys, setFunnelKeys, t, lang }) {
  const C = '#4F46E5'
  const presets = PRESET_FUNNELS[lang] || PRESET_FUNNELS.en
  const [expandedPreset, setExpandedPreset] = useState(null)

  const stages = funnelKeys.map(k => {
    const m = metrics.find(x => x.key === k)
    return { ...m, value: data.summary[m.summaryKey] ?? 0 }
  })
  const firstVal = stages[0]?.value || 1

  function renderDetailChart(stageList) {
    const maxVal = Math.max(...stageList.map(s => s.value), 1)
    const fv = stageList[0]?.value || 0
    return (
      <div style={{ marginTop: 16 }}>
        {/* Bars */}
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
          {stageList.map((stage, i) => (
            <div key={stage.key} style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#555' }}>{stage.label}</div>
          ))}
        </div>
        {/* Step table */}
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
      {/* Preset funnels - 3 column summary cards */}
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

      {/* Expanded preset detail */}
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

      {/* Custom funnel builder */}
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

      {/* Custom funnel chart */}
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

/* ──────────────── UTM Campaign View ──────────────── */

function UtmView({ utm, t }) {
  const [campaignFilter, setCampaignFilter] = useState('all')

  if (!utm || (utm.bySource.length === 0 && utm.byCampaign.length === 0 && utm.byContent.length === 0)) {
    return (
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 40, textAlign: 'center', color: '#999' }}>
        {t.utmNoData}
      </div>
    )
  }

  // Filter content data by selected campaign
  const filteredContent = campaignFilter === 'all'
    ? utm.byContent
    : utm.byContent // content filtering happens server-side in future; for now show all

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

  // Campaign filter chips
  const campaigns = utm.byCampaign.map(c => c.name)

  return (
    <>
      {/* Summary card */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 24, display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{t.utmTotalViews}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#4F46E5' }}>{utm.totalPageViews}</div>
        </div>
        {/* Campaign filter */}
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

      {/* Daily trend for selected campaign */}
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

/* ──────────────── Users View ──────────────── */

function UsersView({ token, t }) {
  const [users, setUsers] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUsers() {
      setLoading(true)
      try {
        const res = await fetch('/api/admin/signup-users', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) setUsers(await res.json())
      } catch (e) {
        console.error(e)
      }
      setLoading(false)
    }
    fetchUsers()
  }, [token])

  function downloadCsv() {
    if (!users || users.length === 0) return
    const headers = ['Email', 'Name', 'Provider', 'Signed Up', 'Last Sign In']
    const rows = users.map(u => [
      u.email,
      u.full_name,
      u.provider,
      u.created_at ? new Date(u.created_at).toLocaleString('ko-KR') : '',
      u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString('ko-KR') : '',
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const bom = '\uFEFF'
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `signup-users-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{t.usersLoading}</div>
  if (!users || users.length === 0) return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>{t.usersEmpty}</div>

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{t.usersTitle}</h3>
          <span style={{ fontSize: 14, color: '#6B7280' }}>{t.usersTotal}: <strong style={{ color: '#4F46E5' }}>{users.length}</strong></span>
        </div>
        <button onClick={downloadCsv}
          style={{
            padding: '8px 16px', border: 'none', borderRadius: 8, fontSize: 13,
            background: '#10B981', color: '#fff', cursor: 'pointer', fontWeight: 600,
          }}>
          {t.usersDownloadCsv}
        </button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#fafafa' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>#</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.usersEmail}</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.usersName}</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.usersProvider}</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.usersCreatedAt}</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.usersLastSignIn}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '8px 12px', color: '#999' }}>{i + 1}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 500 }}>{u.email}</td>
                  <td style={{ padding: '8px 12px', color: '#666' }}>{u.full_name || '-'}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                      background: u.provider === 'google' ? '#E8F5E9' : '#E3F2FD',
                      color: u.provider === 'google' ? '#2E7D32' : '#1565C0',
                    }}>
                      {u.provider || 'email'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', color: '#666', fontSize: 12 }}>
                    {u.created_at ? new Date(u.created_at).toLocaleString('ko-KR') : '-'}
                  </td>
                  <td style={{ padding: '8px 12px', color: '#666', fontSize: 12 }}>
                    {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString('ko-KR') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
