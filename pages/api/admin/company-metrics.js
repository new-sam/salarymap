import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'
import { DEMAND_CATEGORIES, CAT_KO, classifyJobTitle } from '../../../constants/jobs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// 어드민 · 기업 지표 (초안): ① 회사 가입내역 ② ATS 활용/모집 내역.
// 광고로 유입되는 기업 계정과 그들의 채용(공고·지원) 활동을 한 화면에서 본다.
// 데이터: recruiter_companies / recruiter_users / jobs(company_id) / job_applications.

// 지원 파이프라인 단계 표준 순서 (job_applications.status). 실제 값은 pending/viewed/
// reviewing/decided 위주 — 미래에 새 값이 생겨도 누락되지 않게 실제 등장한 값만 이 순서로
// 정렬하고, 목록 밖 값은 뒤에 덧붙인다.
const STAGE_CANON = ['pending', 'applied', 'viewed', 'reviewing', 'decided', 'accepted', 'rejected']

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  // 회사 계정 · 멤버 · 기업 소유 공고 · 지원 — 전부 한 번에 병렬 조회.
  // 지원은 jobs!inner 조인으로 기업 공고분만 서버에서 필터 — jobIds 를 기다리는
  // 직렬 왕복 1회를 없애면서 1000행 캡(전체 지원 성장 시 잘림)도 피한다.
  const [companiesRes, membersRes, jobsRes, appsRes] = await Promise.all([
    supabase.from('recruiter_companies').select('id, name, email_domain, verified_at, created_at').order('created_at', { ascending: false }),
    supabase.from('recruiter_users').select('company_id, email, full_name, role, created_at').order('created_at', { ascending: false }),
    supabase.from('jobs').select('id, company_id, title, status, is_active, created_at').not('company_id', 'is', null).order('created_at', { ascending: false }),
    supabase.from('job_applications').select('job_id, status, rejected_at, created_at, jobs!inner(company_id)').not('jobs.company_id', 'is', null),
  ])
  // 멋사(Likelion) 등 내부/테스트 회사 제외 — 알람(daily-summary)과 동일 규칙.
  // 자체 테스트 지원이 대부분이라 안 빼면 지원·공고당 지원이 뻥튀기됨.
  const EXCLUDED_CO_DOMAINS = ['likelion.net', 'dummy.local', 'system.local']
  const EXCLUDED_CO_NAMES = new Set(['likelion', 'likelion vn', 'likelion vietnam'])
  const isExcludedCo = (c) => EXCLUDED_CO_DOMAINS.includes((c.email_domain || '').toLowerCase()) || EXCLUDED_CO_NAMES.has((c.name || '').trim().toLowerCase())
  const excludedCoIds = new Set((companiesRes.data || []).filter(isExcludedCo).map(c => c.id))
  const companies = (companiesRes.data || []).filter(c => !isExcludedCo(c))
  const members = membersRes.data || []
  const memberCount = {}
  members.forEach(m => { memberCount[m.company_id] = (memberCount[m.company_id] || 0) + 1 })

  const jobs = (jobsRes.data || []).filter(j => !excludedCoIds.has(j.company_id))
  const jobToCompany = {}
  jobs.forEach(j => { jobToCompany[j.id] = j.company_id })

  // 기업 공고에 대한 지원만
  const apps = (appsRes.data || []).filter(ap => jobToCompany[ap.job_id])

  // 회사별 집계
  const agg = {}
  const bump = (cid) => (agg[cid] = agg[cid] || { jobs: 0, live: 0, pending: 0, applications: 0, stages: {} })
  jobs.forEach(j => {
    const a = bump(j.company_id)
    a.jobs += 1
    if (j.status === 'pending_review') a.pending += 1
    else if (j.is_active) a.live += 1
  })
  const jobAppCount = {}       // job_id → 지원 수
  const jobStages = {}         // job_id → { status: count }  (공고별 단계)
  const stageTotals = {}       // 전체 단계별 지원 수
  apps.forEach(ap => {
    jobAppCount[ap.job_id] = (jobAppCount[ap.job_id] || 0) + 1
    // 실제 칸반 단계: rejected_at 있으면 '불합격', 아니면 status(pending/viewed/reviewing/decided)
    const st = ap.rejected_at ? 'rejected' : (ap.status || 'pending')
    ;(jobStages[ap.job_id] = jobStages[ap.job_id] || {})[st] = (jobStages[ap.job_id][st] || 0) + 1
    stageTotals[st] = (stageTotals[st] || 0) + 1
    const cid = jobToCompany[ap.job_id]
    if (!cid) return
    const a = bump(cid)
    a.applications += 1
    a.stages[st] = (a.stages[st] || 0) + 1
  })

  // ① 회사 가입내역 — 계정별 요약 (최신 가입 순)
  const signups = companies.map(c => ({
    id: c.id,
    name: c.name,
    email_domain: c.email_domain,
    verified: !!c.verified_at,
    created_at: c.created_at,
    members: memberCount[c.id] || 0,
    jobs: agg[c.id]?.jobs || 0,
    live: agg[c.id]?.live || 0,
    applications: agg[c.id]?.applications || 0,
    stages: agg[c.id]?.stages || {},
  }))

  // 이번 달 일별 유입 — 하루마다 신규 가입 기업 + 신규 공고 (광고 성과를 일 단위로)
  // 베트남(UTC+7) 날짜 기준 — 알람(daily-summary)과 하루 경계를 맞춘다.
  // (UTC 기준으로 하면 UTC 17시~23시 지원이 하루 앞당겨져 봇과 어긋남)
  const vnNow = new Date(Date.now() + 7 * 3600 * 1000)
  const y = vnNow.getUTCFullYear(), mo = vnNow.getUTCMonth(), todayDom = vnNow.getUTCDate()
  const vnDay = (ts) => ts ? new Date(new Date(ts).getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10) : ''
  const daily = []
  const dayIdx = {}
  for (let i = 1; i <= todayDom; i++) {
    const d = new Date(Date.UTC(y, mo, i)).toISOString().slice(0, 10)
    dayIdx[d] = daily.length
    daily.push({ date: d, companies: 0, jobs: 0, apps: 0 })
  }
  companies.forEach(c => { const d = vnDay(c.created_at); if (d in dayIdx) daily[dayIdx[d]].companies += 1 })
  jobs.forEach(j => { const d = vnDay(j.created_at); if (d in dayIdx) daily[dayIdx[d]].jobs += 1 })
  // 일별 지원 — 기업 자체공고 지원만(멋사 제외 apps 기준). VN 날짜로 집계(봇과 일치).
  apps.forEach(ap => { const d = vnDay(ap.created_at); if (d in dayIdx) daily[dayIdx[d]].apps += 1 })
  const monthLabel = `${y}-${String(mo + 1).padStart(2, '0')}`

  const companyName = Object.fromEntries(companies.map(c => [c.id, c.name]))

  // 드릴다운: 자체 공고 목록 — 지원 많은 순. 번역(titleKo)은 별도 엔드포인트에서 비동기로 채운다.
  const jobsList = jobs.map(j => ({
    id: j.id,
    title: j.title || '(제목 없음)',
    category: classifyJobTitle(j.title),
    categoryKo: CAT_KO[classifyJobTitle(j.title)],
    company_id: j.company_id,
    company: companyName[j.company_id] || '(unknown)',
    status: j.status,
    live: !!(j.is_active && j.status !== 'pending_review'),
    pending: j.status === 'pending_review',
    applications: jobAppCount[j.id] || 0,
    stages: jobStages[j.id] || {},
    created_at: j.created_at,
  })).sort((x, y) => y.applications - x.applications)

  // 직군(수요)별 집계 — 공고 수 / 지원 수 / 공고당 지원. 공고 많은 순.
  const catAgg = Object.fromEntries(DEMAND_CATEGORIES.map(c => [c.key, { jobs: 0, applications: 0 }]))
  jobsList.forEach(j => { const a = catAgg[j.category] || catAgg.other; a.jobs += 1; a.applications += j.applications })
  const byCategory = DEMAND_CATEGORIES
    .map(c => ({ key: c.key, ko: c.ko, jobs: catAgg[c.key].jobs, applications: catAgg[c.key].applications, avgApps: catAgg[c.key].jobs > 0 ? Math.round((catAgg[c.key].applications / catAgg[c.key].jobs) * 10) / 10 : 0 }))
    .filter(c => c.jobs > 0)
    .sort((a, b) => b.jobs - a.jobs)
  // '기타(other)'로 떨어진 제목 — 규칙 보완 검수용
  const otherTitles = jobsList.filter(j => j.category === 'other').map(j => j.title)

  // 실제 등장한 단계만, 표준 순서로 (그 외 값은 뒤에 덧붙임)
  const present = new Set()
  Object.values(agg).forEach(a => Object.keys(a.stages).forEach(s => present.add(s)))
  const stageOrder = [
    ...STAGE_CANON.filter(s => present.has(s)),
    ...[...present].filter(s => !STAGE_CANON.includes(s)),
  ]

  const overview = {
    companies: companies.length,
    verified: companies.filter(c => c.verified_at).length,
    members: members.length,
    jobsCompanySelf: jobs.length,
    jobsPending: jobs.filter(j => j.status === 'pending_review').length,
    jobsLive: jobs.filter(j => j.is_active && j.status !== 'pending_review').length,
    applications: apps.length,
    activeCompanies: Object.values(agg).filter(a => a.jobs > 0).length, // 자체 공고를 하나라도 올린 회사
    // 공고당 평균 지원 = 지원이 1건+ 들어온 공고 기준(0 지원·미노출 공고 제외).
    // 공고 상태(라이브/paused)는 변동이 커 분모로 부적합 → 지원 유무로 고정.
    jobsWithApps: Object.keys(jobAppCount).length,
    avgAppsPerJob: Object.keys(jobAppCount).length > 0
      ? Math.round((apps.length / Object.keys(jobAppCount).length) * 10) / 10
      : 0,
    // 공고당 지원 (중위) — 알람(daily-summary)과 동일. 지원 들어온 공고들의
    // 공고별 지원수 중위값. 평균은 소수 폭주공고에 왜곡되므로 중위값으로 통일.
    medianAppsPerJob: (() => {
      const s = Object.values(jobAppCount).sort((a, b) => a - b)
      if (!s.length) return 0
      const m = Math.floor(s.length / 2)
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
    })(),
  }

  return res.status(200).json({ overview, signups, daily, monthLabel, byCategory, otherTitles, jobsList, stageTotals, stageOrder })
}
