import { useState, useEffect, useRef, Fragment } from 'react'
import Head from 'next/head'
import dynamic from 'next/dynamic'
import { supabase } from '../../lib/supabaseClient'
import { useAdmin, prefetchAdmin } from '../../lib/adminSwr'
import { useT } from '../../lib/i18n'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/admin/AdminLayout'
import DateRangePicker from '../../components/admin/DateRangePicker'
import Icon from '../../components/Icon'
import FunnelView from '../../components/admin/FunnelView'
import ApplicationsView from '../../components/admin/ApplicationsView'
import ResumesView from '../../components/admin/ResumesView'
import TalentPoolView from '../../components/admin/TalentPoolView'
import TalentSupplyView from '../../components/admin/TalentSupplyView'
import VerificationsView from '../../components/admin/VerificationsView'
import CommunityView from '../../components/admin/CommunityView'
import CompanyView from '../../components/admin/CompanyView'
import OutreachView from '../../components/admin/OutreachView'
import RecommendView from '../../components/admin/RecommendView'
import GoalMetricsView from '../../components/admin/GoalMetricsView'
import {
  T, METRICS_BASE, EXP_COLORS, COLORS,
  inputStyle, sectionStyle, sectionTitle,
} from '../../constants/dashboard'
import { aggregateDaily, localDate } from '../../utils/dashboard'

const MetricChart = dynamic(() => import('../../components/DashboardCharts'), { ssr: false })
// AppMetricsView pulls in recharts; load it lazily so the base admin bundle
// doesn't carry the charting lib for tabs that don't render charts.
const AppMetricsView = dynamic(() => import('../../components/admin/AppMetricsView'), { ssr: false })

function cellPct(cur, prev) {
  if (cur === null || cur === undefined || prev === null || prev === undefined) return null
  if (prev === 0) return cur > 0 ? 100 : 0
  return Math.round(((cur - prev) / prev) * 100)
}

// 퍼포먼스 대시보드 섹션 구분 (섹션별 강조색)
const SECTION_LABELS = {
  basic: { ko: '기본 정보', en: 'Basics', accent: '#2563EB' },
  talent: { ko: '인재 채용 지표', en: 'Talent funnel', accent: '#0D9488' },
  company: { ko: '기업 채용 지표', en: 'Company funnel', accent: '#EA580C' },
}
const TIER_LABELS = {
  primary: { ko: '주요 지표', en: 'Key metrics' },
  secondary: { ko: '보조 지표', en: 'Sub metrics' },
}
// 기업 채용 섹션 카드 (요약 숫자 — 일별 차트 미연동)
const B2B_CARDS = [
  { key: 'forClicks', summaryKey: 'totalForCompaniesClicks', ko: '홈→기업채용 클릭', en: 'Home→For-companies click', tier: 'primary' },
  { key: 'contactClicks', summaryKey: 'totalContactOwnerClicks', ko: '담당자 대화 버튼 클릭', en: 'Contact button clicks', tier: 'primary' },
  { key: 'postJobClicks', summaryKey: 'totalPostJobClicks', ko: '공고 올리기 버튼 클릭', en: 'Post-job button clicks', tier: 'primary' },
  { key: 'companySignups', summaryKey: 'totalCompanySignups', ko: '기업 회원 가입', en: 'Company sign-ups', tier: 'primary' },
  { key: 'pendingJobs', summaryKey: 'pendingJobs', ko: '기업 공고 승인 대기', en: 'Jobs pending approval', tier: 'primary' },
]

export default function AdminDashboard() {
  const [auth, setAuth] = useState('loading')
  const [token, setToken] = useState(null)
  const [selected, setSelected] = useState([])
  const [lastUpdated, setLastUpdated] = useState(null)
  const [expForm, setExpForm] = useState({ title: '', date: '', color: EXP_COLORS[0], metrics: [] })
  const [showExpForm, setShowExpForm] = useState(false)
  const { lang: globalLang } = useT()
  // Admin dashboard only ships ko/en; fall back to en for any other global lang (e.g. vi)
  const lang = globalLang === 'ko' ? 'ko' : 'en'
  const router = useRouter()
  const tab = router.query.tab || 'trend'
  // 날짜 범위를 실제로 쓰는 탭에서만 날짜 피커 노출 (이력서/인재풀/연봉인증은 누적 목록이라 무관)
  const showDatePicker = ['trend', 'funnel', 'applications', 'community', 'appMetrics'].includes(tab)
  const [funnelKeys, setFunnelKeys] = useState([])
  const [chartMode, setChartMode] = useState('1d')
  const [tableView, setTableView] = useState('daily')
  const [tableSection, setTableSection] = useState('basic')
  const tableScrollRef = useRef(null)
  const [dualAxis, setDualAxis] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const yesterday = (() => {
    const d = new Date(Date.now() - 86400000)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()
  const todayStr = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()
  const [dateRange, setDateRange] = useState({ from: '2026-04-20', to: todayStr })

  // SWR: 캐시로 탭 전환/페이지 재방문 시 즉시 표시 + 백그라운드 갱신. 키에 날짜/언어 포함.
  // 무거운 데이터는 실제로 쓰는 탭에서만 로드 — data/ga4 는 추이·퍼널, realtime/experiments 는
  // 추이 전용. 다른 탭(기업 등)이 자기 요청만 발사하도록 게이트해 초기 로딩 경쟁을 없앤다.
  const needsCore = ['trend', 'funnel'].includes(tab)
  const { data, isLoading: loading } = useAdmin(
    needsCore ? `/api/admin/dashboard?from=${dateRange.from}&to=${dateRange.to}&lang=${lang}` : null, token
  )
  const { data: ga4 } = useAdmin(needsCore ? `/api/admin/ga4?from=${dateRange.from}&to=${dateRange.to}` : null, token)
  const { data: realtime } = useAdmin(tab === 'trend' ? '/api/admin/realtime' : null, token, {
    refreshInterval: autoRefresh ? 30000 : 0,
  })
  const { data: experiments = [], mutate: mutateExperiments } = useAdmin(tab === 'trend' ? '/api/admin/experiments' : null, token)

  // 마지막 갱신 시각 표시용 — 데이터/실시간 갱신 때마다 기록
  useEffect(() => { if (data || realtime) setLastUpdated(new Date()) }, [data, realtime])

  // 다른 탭 데이터 백그라운드 프리페치 — 인증되면 자주 쓰는 탭의 엔드포인트를 미리
  // 캐시에 채워, 첫 진입 지연(콜드스타트+실데이터 쿼리)을 사용자가 체감하지 않게 한다.
  // 키는 각 View 의 useAdmin URL 과 글자까지 동일해야 적중한다.
  useEffect(() => {
    if (!token) return
    const appParams = new URLSearchParams()
    if (dateRange.from) appParams.set('from', dateRange.from)
    if (dateRange.to) appParams.set('to', dateRange.to)
    const today = (() => {
      const d = new Date()
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })()
    const effectiveTo = dateRange.to >= yesterday ? today : dateRange.to
    const urls = [
      '/api/admin/resumes',                                            // resumes + talent (공유)
      `/api/admin/applications?${appParams}`,                          // applications
      `/api/admin/community?from=${dateRange.from}&to=${dateRange.to}`, // community
      `/api/admin/app-metrics?from=${dateRange.from}&to=${effectiveTo}`, // appMetrics
      '/api/salary-verification/admin?status=pending',                 // verifications(기본 필터)
    ]
    // 활성 탭(추이)의 메인 요청이 먼저 나가도록 살짝 늦춰 경쟁을 피한다.
    const id = setTimeout(() => urls.forEach(u => prefetchAdmin(u, token)), 800)
    return () => clearTimeout(id)
  }, [token, dateRange.from, dateRange.to])

  // 일별 뷰 진입/섹션 변경/데이터 로드 시 최신(맨 아래)로 스크롤
  useEffect(() => {
    if (tableView === 'daily' && tableScrollRef.current) {
      tableScrollRef.current.scrollTop = tableScrollRef.current.scrollHeight
    }
  }, [tableView, tableSection, loading])

  const t = T[lang]
  const METRICS = METRICS_BASE.map(m => ({ ...m, label: t.metrics[m.key] }))

  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` })

  useEffect(() => {
    // Dev convenience: skip OAuth + admin check locally so admin views can
    // be previewed without redoing login on every browser/profile. Paired
    // with verifyAdminOrDevStub on the API side. Production untouched.
    if (process.env.NODE_ENV === 'development') {
      setAuth('ok')
      setToken('dev-local')
      return
    }
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
    // 토큰은 만료(기본 1시간)되므로 한 번 잡아둔 값은 곧 죽는다. supabase가
    // 백그라운드에서 갱신할 때(TOKEN_REFRESHED) state도 최신 토큰으로 교체해,
    // 모든 어드민 API 호출이 만료 토큰으로 401 나는 걸 막는다.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) setToken(session.access_token)
    })
    return () => subscription?.unsubscribe()
  }, [])


  const [editingExp, setEditingExp] = useState(null)

  async function addExperiment() {
    if (!expForm.title || !expForm.date) return
    const res = await fetch('/api/admin/experiments', {
      method: 'POST', headers: headers(), body: JSON.stringify(expForm)
    })
    if (res.ok) {
      setExpForm({ title: '', date: '', color: EXP_COLORS[experiments.length % EXP_COLORS.length], metrics: [] })
      setShowExpForm(false)
      mutateExperiments()
    }
  }

  async function updateExperiment() {
    if (!editingExp || !editingExp.title || !editingExp.date) return
    const res = await fetch('/api/admin/experiments', {
      method: 'PUT', headers: headers(), body: JSON.stringify(editingExp)
    })
    if (res.ok) {
      setEditingExp(null)
      mutateExperiments()
    }
  }

  async function deleteExperiment(id) {
    if (!confirm(t.expDeleteConfirm)) return
    await fetch('/api/admin/experiments', {
      method: 'DELETE', headers: headers(), body: JSON.stringify({ id })
    })
    setEditingExp(null)
    mutateExperiments()
  }

  if (auth === 'loading') return <div style={{ padding: 40, textAlign: 'center' }}>{t.loading}</div>
  if (auth === 'denied') return <div style={{ padding: 40, textAlign: 'center' }}>{t.denied}</div>

  const selectedMetrics = METRICS.filter(m => selected.includes(m.key))

  const dailyWithToday = (() => {
    if (!data?.daily) return data?.daily
    // Merge GA4 sessions into daily data
    const ga4Map = {}
    if (ga4?.daily) {
      for (const d of ga4.daily) ga4Map[d.date] = { sessions: d.sessions, totalUsers: d.totalUsers, newUsers: d.newUsers, engagedSessions: d.engagedSessions }
    }
    let merged = data.daily.map(d => ({
      ...d,
      sessions: ga4Map[d.date]?.sessions ?? 0,
      ga4Users: ga4Map[d.date]?.totalUsers ?? 0,
      ga4NewUsers: ga4Map[d.date]?.newUsers ?? 0,
      ga4Engaged: ga4Map[d.date]?.engagedSessions ?? 0,
    }))

    if (!realtime) return merged
    const today = realtime.date
    if (today > dateRange.to && today !== localDate(Date.now())) return merged
    // 이력서 공개(앱/웹)는 realtime 이벤트가 없고 DB 상태 스냅샷이라 today 행 교체 시
    // API가 준 오늘 값을 그대로 보존한다(교체로 라인이 끊기지 않게).
    const prevToday = merged.find(d => d.date === today)
    const todayData = {
      date: today,
      resumePublic: prevToday?.resumePublic ?? null,
      resumePublicApp: prevToday?.resumePublicApp ?? null,
      resumePublicWeb: prevToday?.resumePublicWeb ?? null,
      sessions: ga4?.today?.sessions ?? 0,
      submissions: realtime.submissions,
      ad: realtime.ad,
      organic: realtime.organic,
      signups: realtime.signups,
      companies: realtime.companies ?? 0,
      jobClicks: realtime.jobClicks,
      cardClicks: realtime.cardClicks,
      jobApps: realtime.jobApps,
      jobAppsCompany: realtime.jobAppsCompany ?? 0,
      cvSuccessApps: realtime.cvSuccessApps ?? 0,
      jobsPageViews: realtime.jobsPageViews ?? 0,
      applyClicks: realtime.applyClicks ?? 0,
      saveClicks: realtime.saveClicks ?? 0,
      resumeUploads: realtime.resumeUploads ?? 0,
      landings: realtime.landings ?? 0,
      forCompaniesClicks: realtime.forCompaniesClicks ?? 0,
      contactClicks: realtime.contactClicks ?? 0,
      postJobClicks: realtime.postJobClicks ?? 0,
      companySignups: realtime.companySignups ?? 0,
    }
    const exists = merged.some(d => d.date === today)
    if (exists) return merged.map(d => d.date === today ? todayData : d)
    return [...merged, todayData]
  })()

  const summary = (() => {
    if (!data?.summary) return data?.summary
    const base = {
      ...data.summary,
      totalSessions: ga4?.totals?.sessions ?? 0,
      ga4TotalUsers: ga4?.totals?.totalUsers ?? 0,
      ga4NewUsers: ga4?.totals?.newUsers ?? 0,
      ga4EngagedSessions: ga4?.totals?.engagedSessions ?? 0,
    }
    if (!realtime) return base
    const today = realtime.date
    const todayInRange = data.daily?.find(d => d.date === today)
    if (!todayInRange && today > dateRange.to) return base
    const diff = (rtKey, dayKey) => (realtime[rtKey] ?? 0) - (todayInRange?.[dayKey ?? rtKey] ?? 0)
    return {
      ...base,
      totalSubmissions: data.summary.totalSubmissions + diff('submissions'),
      adSubmissions: data.summary.adSubmissions + diff('ad'),
      organicSubmissions: data.summary.organicSubmissions + diff('organic'),
      totalSignups: data.summary.totalSignups + diff('signups'),
      totalJobApps: data.summary.totalJobApps + diff('jobApps'),
      totalJobAppsCompany: data.summary.totalJobAppsCompany + diff('jobAppsCompany'),
      totalCvSuccessApps: data.summary.totalCvSuccessApps + diff('cvSuccessApps'),
      totalJobClicks: data.summary.totalJobClicks + diff('jobClicks'),
      totalCardClicks: data.summary.totalCardClicks + diff('cardClicks'),
    }
  })()

  const weeklyTableData = (() => {
    if (!dailyWithToday || tableView !== 'weekly') return null
    const weeks = {}
    for (const d of dailyWithToday) {
      const dt = new Date(d.date + 'T00:00:00')
      const day = dt.getDay()
      const mon = new Date(dt)
      mon.setDate(dt.getDate() - ((day + 6) % 7))
      const key = mon.toISOString().slice(0, 10)
      if (!weeks[key]) weeks[key] = { start: key, end: d.date, days: [] }
      weeks[key].end = d.date
      weeks[key].days.push(d)
    }
    return Object.values(weeks).map(w => {
      const sum = (k) => {
        const vals = w.days.map(d => d[k]).filter(v => v !== null && v !== undefined)
        return vals.length ? vals.reduce((a, b) => a + b, 0) : null
      }
      return {
        label: `${w.start.slice(5)} ~ ${w.end.slice(5)}`,
        sessions: sum('sessions'),
        submissions: sum('submissions') ?? 0,
        ad: sum('ad') ?? 0,
        organic: sum('organic') ?? 0,
        signups: sum('signups') ?? 0,
        companies: sum('companies') ?? 0,
        jobClicks: sum('jobClicks'),
        cardClicks: sum('cardClicks'),
        jobsPageViews: sum('jobsPageViews'),
        applyClicks: sum('applyClicks'),
        saveClicks: sum('saveClicks'),
        resumeUploads: sum('resumeUploads'),
        resumePublic: sum('resumePublic'),
        resumePublicApp: sum('resumePublicApp'),
        resumePublicWeb: sum('resumePublicWeb'),
        jobApps: sum('jobApps') ?? 0,
        forCompaniesClicks: sum('forCompaniesClicks'),
        contactClicks: sum('contactClicks'),
        postJobClicks: sum('postJobClicks'),
        companySignups: sum('companySignups') ?? 0,
      }
    })
  })()

  const monthlyTableData = (() => {
    if (!dailyWithToday || tableView !== 'monthly') return null
    const months = {}
    for (const d of dailyWithToday) {
      const key = d.date.slice(0, 7)
      if (!months[key]) months[key] = { label: key, days: [] }
      months[key].days.push(d)
    }
    return Object.values(months).map(w => {
      const sum = (k) => {
        const vals = w.days.map(d => d[k]).filter(v => v !== null && v !== undefined)
        return vals.length ? vals.reduce((a, b) => a + b, 0) : null
      }
      return {
        label: w.label,
        sessions: sum('sessions'),
        submissions: sum('submissions') ?? 0,
        ad: sum('ad') ?? 0,
        organic: sum('organic') ?? 0,
        signups: sum('signups') ?? 0,
        companies: sum('companies') ?? 0,
        jobClicks: sum('jobClicks'),
        cardClicks: sum('cardClicks'),
        jobsPageViews: sum('jobsPageViews'),
        applyClicks: sum('applyClicks'),
        saveClicks: sum('saveClicks'),
        resumeUploads: sum('resumeUploads'),
        resumePublic: sum('resumePublic'),
        resumePublicApp: sum('resumePublicApp'),
        resumePublicWeb: sum('resumePublicWeb'),
        jobApps: sum('jobApps') ?? 0,
        forCompaniesClicks: sum('forCompaniesClicks'),
        contactClicks: sum('contactClicks'),
        postJobClicks: sum('postJobClicks'),
        companySignups: sum('companySignups') ?? 0,
      }
    })
  })()

  const chartData = aggregateDaily(dailyWithToday, chartMode)

  // 일별/주별/월별 테이블 컬럼 — 섹션 단위로 묶어서 표시 (가로 폭 폭주 방지)
  const tableColumns = tableSection === 'company'
    ? [
        { key: 'forCompaniesClicks', label: lang === 'ko' ? '홈→기업채용 클릭' : 'Home→For-companies', summaryKey: 'totalForCompaniesClicks' },
        { key: 'contactClicks', label: lang === 'ko' ? '담당자 대화 클릭' : 'Contact clicks', summaryKey: 'totalContactOwnerClicks' },
        { key: 'postJobClicks', label: lang === 'ko' ? '공고 올리기 클릭' : 'Post-job clicks', summaryKey: 'totalPostJobClicks' },
        { key: 'companySignups', label: lang === 'ko' ? '기업 회원 가입' : 'Company sign-ups', summaryKey: 'totalCompanySignups' },
      ]
    : tableSection === 'basic'
    ? (() => {
        const byKey = (k) => METRICS.find(m => m.key === k)
        const subLabel = { ad: lang === 'ko' ? '└ 광고' : '└ Ad', organic: lang === 'ko' ? '└ 자연' : '└ Organic', companies: lang === 'ko' ? '└ 회사수' : '└ Companies' }
        // 퍼널 순서(세션→제출→가입) + 광고/자연/회사수는 '연봉 제출' 바로 옆 하위로
        return ['sessions', 'submissions', 'ad', 'organic', 'companies', 'signups'].map(k => {
          const m = byKey(k)
          const sub = k === 'ad' || k === 'organic' || k === 'companies'
          return { key: m.dataKey, label: sub ? subLabel[k] : m.label, summaryKey: m.summaryKey, sub }
        })
      })()
    : METRICS.filter(m => m.section === tableSection).map(m => ({ key: m.dataKey, label: m.label, summaryKey: m.summaryKey }))
  const visibleExperiments = experiments.filter(e => (!e.status || e.status === 'running') && e.date >= dateRange.from && e.date <= (realtime?.date || dateRange.to) && (!e.metrics?.length || selected.length === 0 || selected.some(k => e.metrics.includes(k))))

  return (
    <>
      <Head><title>FYI {t.title}</title></Head>
      <style>{`
        .adm-dash { max-width: 1200px; margin: 0 auto; padding: 24px 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .adm-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .adm-header-title { display: flex; align-items: center; gap: 12px; }
        .adm-header-controls { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
        .adm-grid-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
        @media (max-width: 768px) {
          .adm-dash { padding: 16px 12px 80px 12px; }
          .adm-header { flex-direction: column; align-items: flex-start; gap: 12px; }
          .adm-header-controls { width: 100%; flex-wrap: wrap; }
          .adm-header-controls input[type="date"] { width: 110px; font-size: 12px; }
          .adm-grid-2col { grid-template-columns: 1fr; }
          .adm-metric-cards { grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)) !important; gap: 8px !important; }
          .adm-metric-cards > div { padding: 12px 14px !important; }
          .adm-metric-cards .adm-metric-value { font-size: 22px !important; }
          .adm-realtime-grid { grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)) !important; gap: 6px !important; }
          .adm-realtime-grid > div { padding: 8px 6px !important; }
          .adm-realtime-grid .adm-rt-value { font-size: 18px !important; }
        }
      `}</style>
      <AdminLayout>
      <div className="adm-dash">
        {/* Header — 날짜 피커는 날짜 쓰는 탭에서만 */}
        {showDatePicker && (
          <div className="adm-header">
            <div className="adm-header-controls">
              <DateRangePicker value={dateRange} onChange={(from, to) => setDateRange({ from, to })} />
              {loading && <span style={{ fontSize: 12, color: '#9AA0A6' }}>{lang === 'ko' ? '불러오는 중…' : 'Loading…'}</span>}
            </div>
          </div>
        )}

        {/* Today Realtime — 추이 탭에서만 표시 */}
        {realtime && tab === 'trend' && (
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
            <div className="adm-realtime-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8 }}>
              {[
                { label: t.metrics.sessions, value: ga4?.today?.sessions ?? '-', color: '#2563EB' },
                { label: t.metrics.submissions, value: realtime.submissions, color: '#e2e8f0' },
                { label: t.metrics.ad, value: realtime.ad, color: '#818cf8' },
                { label: t.metrics.organic, value: realtime.organic, color: '#34d399' },
                { label: t.metrics.signups, value: realtime.signups, color: '#fbbf24' },
                { label: t.pageViews, value: realtime.landings, color: '#a78bfa' },
                { label: t.metrics.jobClicks, value: realtime.jobClicks, color: '#fb923c' },
                { label: t.metrics.cardClicks, value: realtime.cardClicks, color: '#f472b6' },
                { label: t.metrics.resumeUploads, value: realtime.resumeUploads, color: '#14B8A6' },
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
            {selected.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <button onClick={() => setSelected([])}
                  style={{ padding: '3px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 11, background: '#fff', cursor: 'pointer', color: '#888' }}>
                  {lang === 'ko' ? '선택 초기화' : 'Clear selection'} ({selected.length})
                </button>
              </div>
            )}
            {['basic', 'talent', 'company'].map(sec => {
              const cards = sec === 'company'
                ? B2B_CARDS.map(c => ({ key: c.key, label: c[lang] || c.ko, value: summary[c.summaryKey] ?? '-', tier: c.tier, clickable: false }))
                : METRICS.filter(m => m.section === sec).map(m => {
                    const noTracking = (m.key === 'jobClicks' || m.key === 'cardClicks') && !summary.hasEventTracking
                    return {
                      key: m.key, label: m.label,
                      value: noTracking ? '-' : summary[m.summaryKey],
                      tier: m.tier, clickable: true,
                    }
                  })
              const accent = SECTION_LABELS[sec].accent
              const primary = cards.filter(c => c.tier === 'primary')
              const secondary = cards.filter(c => c.tier !== 'primary')
              const renderCard = (c, big) => {
                const isActive = c.clickable && selected.includes(c.key)
                return (
                  <div key={c.key}
                    onClick={c.clickable ? () => setSelected(prev => isActive ? prev.filter(k => k !== c.key) : [...prev, c.key]) : undefined}
                    style={{
                      background: isActive ? accent + '14' : (big ? '#fff' : '#F8FAFB'),
                      border: `1px solid ${isActive ? accent : (big ? '#E5E8EB' : '#EEF1F3')}`,
                      borderLeft: big ? `3px solid ${accent}` : undefined,
                      borderRadius: big ? 10 : 8, padding: big ? '15px 17px' : '10px 12px',
                      cursor: c.clickable ? 'pointer' : 'default',
                      transition: 'border-color 0.12s ease, background 0.12s ease',
                    }}>
                    <div style={{ fontSize: big ? 13 : 11.5, color: big ? '#4E5968' : '#8B95A1', marginBottom: big ? 7 : 4, fontWeight: big ? 700 : 600 }}>{c.label}</div>
                    <div style={{ fontSize: big ? 30 : 18, fontWeight: 800, color: big ? accent : '#4E5968', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.05 }}>{c.value}</div>
                  </div>
                )
              }
              const tierLabel = (tier) => (
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8B95A1', margin: '0 0 7px', letterSpacing: '0.02em' }}>{TIER_LABELS[tier][lang]}</div>
              )
              return (
                <Fragment key={sec}>
                <div style={{ marginBottom: 28 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, paddingBottom: 9, borderBottom: '1px solid #EEF1F3' }}>
                    <span style={{ width: 4, height: 17, borderRadius: 2, background: accent }} />
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#191F28', letterSpacing: '-0.01em' }}>{SECTION_LABELS[sec][lang]}</span>
                  </div>
                  {primary.length > 0 && (
                    <div style={{ marginBottom: secondary.length ? 16 : 0 }}>
                      {secondary.length > 0 && tierLabel('primary')}
                      <div className="adm-metric-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
                        {primary.map(c => renderCard(c, true))}
                      </div>
                    </div>
                  )}
                  {secondary.length > 0 && (
                    <div style={sec === 'basic' ? { paddingLeft: 14, borderLeft: '2px solid #EEF1F3', marginLeft: 2 } : undefined}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#8B95A1', margin: '0 0 7px', letterSpacing: '0.02em' }}>
                        {sec === 'basic' ? (lang === 'ko' ? '↳ 연봉 제출 구성 (광고·자연·회사수)' : '↳ Submission breakdown') : TIER_LABELS.secondary[lang]}
                      </div>
                      <div className="adm-metric-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(116px, 1fr))', gap: 8 }}>
                        {secondary.map(c => renderCard(c, false))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Chart — 인재 지표 바로 아래 */}
                {sec === 'talent' && selectedMetrics.length > 0 && (
                  <div style={sectionStyle}>
                    <div className="adm-chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                      <h3 style={{ ...sectionTitle, margin: 0 }}>{selectedMetrics.map(m => m.label).join(' + ')} {t.trend}</h3>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {selectedMetrics.length === 2 && (
                          <button onClick={() => setDualAxis(v => !v)}
                            style={{
                              padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                              border: '1px solid #d1d5db', cursor: 'pointer', transition: 'all 0.15s',
                              background: dualAxis ? '#EEF2FF' : '#fff',
                              color: dualAxis ? '#4F46E5' : '#999',
                            }}>
                            {lang === 'ko' ? (dualAxis ? 'Y축 분리' : 'Y축 공유') : (dualAxis ? 'Dual Y' : 'Shared Y')}
                          </button>
                        )}
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
                    </div>
                    <MetricChart daily={chartData} metrics={selectedMetrics} experiments={chartMode === '1d' ? visibleExperiments : []} avgLabel={t.avg} lang={lang} dualAxis={dualAxis} />

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
                </Fragment>
              )
            })}

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
                    onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) addExperiment() }}
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
                            onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) updateExperiment() }}
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
                        {/* Status & Result */}
                        <div style={{ padding: '10px 0', borderTop: '1px solid #e5e7eb', marginTop: 4 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 11, color: '#888', minWidth: 32 }}>{t.expStatus}</span>
                            {['running', 'success', 'failure'].map(s => {
                              const on = (editingExp.status || 'running') === s
                              const colors = { running: '#2563EB', success: '#10B981', failure: '#EF4444' }
                              const labels = { running: t.expRunning, success: t.expSuccess, failure: t.expFailure }
                              return (
                                <button key={s} onClick={() => setEditingExp(f => ({ ...f, status: s, ...(s !== 'running' && !f.end_date ? { end_date: new Date().toISOString().slice(0, 10) } : {}) }))}
                                  style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, border: on ? `1.5px solid ${colors[s]}` : '1px solid #ddd', background: on ? colors[s] + '18' : '#fff', color: on ? colors[s] : '#999', cursor: 'pointer' }}>
                                  {labels[s]}
                                </button>
                              )
                            })}
                            {(editingExp.status === 'success' || editingExp.status === 'failure') && (
                              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#888', marginLeft: 8 }}>
                                {t.expEndDate}
                                <input type="date" value={editingExp.end_date || ''} onChange={e => setEditingExp(f => ({ ...f, end_date: e.target.value }))}
                                  style={{ ...inputStyle, width: 130, fontSize: 12 }} />
                              </label>
                            )}
                          </div>
                          {(editingExp.status === 'success' || editingExp.status === 'failure') && (
                            <textarea value={editingExp.result_note || ''} onChange={e => setEditingExp(f => ({ ...f, result_note: e.target.value }))}
                              placeholder={t.expResultPlaceholder}
                              style={{ ...inputStyle, width: '100%', minHeight: 60, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                          )}
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
                      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                      padding: '8px 12px', borderRadius: 8, background: '#fafafa', fontSize: 13, cursor: 'pointer',
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: exp.color, flexShrink: 0 }} />
                          <span style={{ fontWeight: 500 }}>{exp.title}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 18, flexWrap: 'wrap' }}>
                          <span style={{ color: '#999', fontSize: 11 }}>{exp.date}{exp.end_date ? ` → ${exp.end_date}` : ''}</span>
                          {exp.metrics?.length > 0 && (
                            <>
                              <span style={{ color: '#ddd', fontSize: 11 }}>·</span>
                              {exp.metrics.map(mk => {
                                const mb = METRICS_BASE.find(x => x.key === mk)
                                return mb ? <span key={mk} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: mb.color + '18', color: mb.color, fontWeight: 600 }}>{t.metrics[mk] || mk}</span> : null
                              })}
                            </>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexShrink: 0 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {(() => {
                              const s = exp.status || 'running'
                              const cfg = { running: { bg: '#DBEAFE', color: '#1E40AF', icon: '●' }, success: { bg: '#D1FAE5', color: '#065F46', icon: '✓' }, failure: { bg: '#FEE2E2', color: '#991B1B', icon: '✗' } }
                              const c = cfg[s]
                              const labels = { running: t.expRunning, success: t.expSuccess, failure: t.expFailure }
                              return <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 4, background: c.bg, color: c.color, fontWeight: 700, whiteSpace: 'nowrap' }}>{c.icon} {labels[s]}</span>
                            })()}
                            {(!exp.status || exp.status === 'running') && (
                              <button onClick={e => { e.stopPropagation(); setEditingExp({ ...exp, metrics: exp.metrics || [], status: 'success', end_date: new Date().toISOString().slice(0, 10) }) }}
                                style={{ padding: '3px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 11, background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>
                                {t.expEnd}
                              </button>
                            )}
                          </div>
                          {exp.result_note && (
                            <div style={{ fontSize: 11, color: '#888', lineHeight: 1.4, maxWidth: 200, textAlign: 'right' }}>{exp.result_note}</div>
                          )}
                        </div>
                        <Icon name="edit" size={11} color="#ccc" style={{ marginTop: 4 }} />
                      </div>
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
            <div className="adm-grid-2col">
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 }}>
                <h3 style={sectionTitle}>
                  {tableView === 'weekly' ? t.weeklyDetail : tableView === 'monthly' ? t.monthlyDetail : t.dailyDetail}
                  {tableView !== 'daily' && (
                    <span style={{ fontSize: 11, fontWeight: 500, color: '#9CA3AF', marginLeft: 8 }}>
                      {lang === 'ko' ? '변화율' : 'Change'}: {tableView === 'weekly' ? 'WoW' : 'MoM'}
                    </span>
                  )}
                </h3>
                <div style={{ display: 'flex', gap: 0, background: '#f3f4f6', borderRadius: 8, padding: 2 }}>
                  {[
                    { key: 'daily', label: lang === 'ko' ? '일별' : 'Daily' },
                    { key: 'weekly', label: lang === 'ko' ? '주별' : 'Weekly' },
                    { key: 'monthly', label: lang === 'ko' ? '월별' : 'Monthly' },
                  ].map(m => (
                    <button key={m.key} onClick={() => setTableView(m.key)}
                      style={{
                        padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                        border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                        background: tableView === m.key ? '#fff' : 'transparent',
                        color: tableView === m.key ? '#111' : '#999',
                        boxShadow: tableView === m.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      }}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* 섹션 선택 — 누른 섹션의 지표들만 열로 (가로 폭주 방지) */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {['basic', 'talent', 'company'].map(s => (
                  <button key={s} onClick={() => setTableSection(s)}
                    style={{
                      padding: '6px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700,
                      border: `1px solid ${tableSection === s ? SECTION_LABELS[s].accent : '#E5E8EB'}`,
                      background: tableSection === s ? SECTION_LABELS[s].accent + '14' : '#fff',
                      color: tableSection === s ? SECTION_LABELS[s].accent : '#6B7280',
                      cursor: 'pointer', transition: 'all 0.12s',
                    }}>
                    {SECTION_LABELS[s][lang]}
                  </button>
                ))}
              </div>
              <div ref={tableScrollRef} style={{ maxHeight: 420, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', position: 'sticky', top: 0, background: '#fff', boxShadow: 'inset 0 -2px 0 #e5e7eb', zIndex: 3 }}>{tableView === 'daily' ? (lang === 'ko' ? '날짜' : 'Date') : (lang === 'ko' ? '기간' : 'Period')}</th>
                      {tableColumns.map(c => (
                        <th key={c.key} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: c.sub ? 500 : 600, color: c.sub ? '#9CA3AF' : '#374151', fontSize: c.sub ? 12 : undefined, position: 'sticky', top: 0, background: c.sub ? '#F6F8FA' : '#fff', boxShadow: 'inset 0 -2px 0 #e5e7eb', zIndex: 3 }}>{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(tableView === 'weekly' ? weeklyTableData : tableView === 'monthly' ? monthlyTableData : dailyWithToday).map((d, i, arr) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '6px 12px' }}>{tableView === 'daily' ? d.date : d.label}</td>
                        {tableColumns.map(col => {
                          const val = d[col.key]
                          const isNull = val === null || val === undefined
                          const prev = (tableView !== 'daily' && i > 0) ? arr[i - 1][col.key] : null
                          const pct = tableView !== 'daily' ? cellPct(val, prev) : null
                          return (
                            <td key={col.key} style={{ padding: '6px 12px', textAlign: 'right', color: isNull ? '#ccc' : (col.sub ? '#8B95A1' : (col.color || undefined)), fontWeight: col.bold ? 600 : undefined, background: col.sub ? '#F6F8FA' : undefined }}>
                              <div>{isNull ? '-' : val}</div>
                              {pct !== null && (
                                <div style={{ fontSize: 10, fontWeight: 600, color: pct > 0 ? '#EF4444' : pct < 0 ? '#3B82F6' : '#9CA3AF' }}>
                                  {pct > 0 ? '+' : ''}{pct}%
                                </div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                    <tr style={{ fontWeight: 700 }}>
                      <td style={{ padding: '8px 12px', position: 'sticky', bottom: 0, background: '#fff', boxShadow: 'inset 0 2px 0 #e5e7eb' }}>{t.total}</td>
                      {tableColumns.map(c => (
                        <td key={c.key} style={{ padding: '8px 12px', textAlign: 'right', color: c.sub ? '#8B95A1' : '#191F28', position: 'sticky', bottom: 0, background: c.sub ? '#F6F8FA' : '#fff', boxShadow: 'inset 0 2px 0 #e5e7eb' }}>{summary[c.summaryKey] ?? '-'}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Funnel Tab */}
        {data?.summary && !loading && tab === 'funnel' && (
          <FunnelView data={{ ...data, daily: dailyWithToday }} metrics={METRICS} summary={summary} funnelKeys={funnelKeys} setFunnelKeys={setFunnelKeys} t={t} lang={lang} />
        )}

        {/* Applications Tab */}
        {tab === 'applications' && (
          <ApplicationsView token={token} t={t} dateRange={dateRange} lang={lang} />
        )}

        {/* Resumes Tab */}
        {tab === 'resumes' && (
          <ResumesView token={token} t={t} lang={lang} />
        )}

        {/* Talent Pool Tab — 공개 이력서 인재풀 */}
        {tab === 'talent' && (
          <TalentPoolView token={token} lang={lang} />
        )}

        {/* Talent Supply Tab — 직군별 공급 구성 스냅샷 */}
        {tab === 'supply' && (
          <TalentSupplyView token={token} lang={lang} />
        )}

        {/* Verifications Tab */}
        {tab === 'verifications' && (
          <VerificationsView token={token} lang={lang} />
        )}

        {/* Community Tab */}
        {tab === 'community' && (
          <CommunityView token={token} lang={lang} dateRange={dateRange} />
        )}

        {/* Company Tab — 기업 가입내역 + ATS 활용/모집 내역 */}
        {tab === 'company' && (
          <CompanyView token={token} lang={lang} />
        )}

        {/* App Metrics Tab */}
        {tab === 'appMetrics' && (
          <AppMetricsView token={token} lang={lang} dateRange={dateRange} />
        )}

        {/* Cold Outreach Tab — 콜드메일 영업 대상/진행 관리 */}
        {(tab === 'outreach' || tab === 'outreach-yh') && (
          <OutreachView key={tab} token={token} lang={lang} owner={tab === 'outreach-yh' ? 'younghun' : 'wsj'} />
        )}

        {/* 광고메일 — 공고 추천 메일 발송/전환 현황 */}
        {tab === 'recommend' && (
          <RecommendView token={token} lang={lang} />
        )}

        {/* Personal · 목표지표 — Sean (개인 비밀번호 게이트) */}
        {tab === 'goals' && (
          <GoalMetricsView token={token} lang={lang} />
        )}

      </div>
      </AdminLayout>
    </>
  )
}
