import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'
import { isExcludedSignup, isExcludedEmail } from '../../../lib/admin-metrics'

// 메인 퍼널 대시보드 — 가입/지원/합격 단계 집계 (유입은 클라이언트가 /api/admin/ga4 로 별도 로드).
// 기간 퍼널: 각 단계는 "기간 내 발생 수" (합격은 기간 내 생성된 지원 중 accepted 된 건).
// 일자 버킷·내부계정 제외는 dashboard.js API 와 동일 규칙 (VN day, isExcludedSignup/Email).

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const toVN = (iso) => new Date(new Date(iso).getTime() + 7 * 3600000).toISOString().slice(0, 10)

async function fetchAll(query) {
  let all = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data } = await query.range(from, from + PAGE - 1)
    all = all.concat(data || [])
    if (!data || data.length < PAGE) break
  }
  return all
}

async function listAllUsers() {
  let page = 1, allUsers = []
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    const users = data?.users || []
    if (error || users.length === 0) break
    allUsers = allUsers.concat(users)
    if (users.length < 1000) break
    page++
  }
  return allUsers
}

// id 목록을 청크로 나눠 user_profiles 를 읽는다 (in() URL 길이 한도 회피).
async function fetchProfiles(ids, columns) {
  const out = []
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase.from('user_profiles').select(columns).in('id', ids.slice(i, i + 200))
    out.push(...(data || []))
  }
  return out
}

export default async function handler(req, res) {
  const user = await verifyAdminOrDevStub(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { from, to } = req.query
  const startDate = from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const endDate = to || new Date().toISOString().slice(0, 10)
  const startISO = new Date(`${startDate}T00:00:00+07:00`).toISOString()
  const endISO = new Date(`${endDate}T23:59:59+07:00`).toISOString()

  // 유입→가입 사이 이탈 지도용 여정 이벤트 (건수 기준 — landing/상세뷰 client_id 계측은 2026-07-16 배포,
  // 위저드·게이트는 7/14 저녁부터 존재. 그 이전 기간을 포함하면 과소계상된다.)
  const JOURNEY_EVENTS = [
    'session_start', 'landing', 'wizard_step_1', 'wizard_step_4', 'result_gate_view', 'sign_up',
    'view_jobs_page', 'view_job_detail', 'click_apply_button',
    'cv_view', 'cv_register_success',
  ]

  try {
    const [allUsers, appsRaw] = await Promise.all([
      listAllUsers(),
      fetchAll(
        supabase.from('job_applications')
          .select('id, created_at, status, application_source, applicant_email, user_id, jobs(title, company, source)')
          .gte('created_at', startISO).lte('created_at', endISO)
          .order('created_at', { ascending: true })
      ).catch(() => []),
    ])

    // ── 가입 ──
    const signupUsers = allUsers.filter(u =>
      u.created_at >= startISO && u.created_at <= endISO && !isExcludedSignup(u))
    const signupProfiles = await fetchProfiles(signupUsers.map(u => u.id), 'id, utm_source, utm_campaign')
    const utmMap = Object.fromEntries(signupProfiles.map(p => [p.id, p]))

    const signupDaily = {}
    const signupSourceMap = {}
    for (const u of signupUsers) {
      const d = toVN(u.created_at)
      signupDaily[d] = (signupDaily[d] || 0) + 1
      const p = utmMap[u.id]
      const key = p?.utm_source
        ? `${p.utm_source}${p.utm_campaign ? ` / ${p.utm_campaign}` : ''}`
        : '(organic/direct)'
      signupSourceMap[key] = (signupSourceMap[key] || 0) + 1
    }

    // ── 지원 (내부/테스트 지원자 제외 — 이메일은 applicant_email > 프로필 순) ──
    const needEmailIds = [...new Set(appsRaw.filter(a => !a.applicant_email && a.user_id).map(a => a.user_id))]
    const emailProfiles = await fetchProfiles(needEmailIds, 'id, email')
    const emailMap = Object.fromEntries(emailProfiles.map(p => [p.id, p.email]))
    const apps = appsRaw.filter(a => !isExcludedEmail(a.applicant_email || emailMap[a.user_id]))

    const applicantKey = (a) => a.user_id || a.applicant_email || `app:${a.id}`
    // real 공고 = 기업 직접등록(company_self) + KTC 시드. 나머지(크롤 wanted/topdev/… + manual)는 fake.
    const isRealJob = (a) => a.jobs?.source === 'company_self' || a.jobs?.source === 'ktc'
    const appDaily = {}       // date → { count, real, users:Set }
    const appSourceMap = {}
    const appStatusMap = {}
    const jobSourceMap = {}   // jobs.source → 지원 건수
    const jobMap = {}         // company·title → { company, title, source, count, accepted }
    const realAgg = { real: { count: 0, users: new Set() }, fake: { count: 0, users: new Set() } }
    for (const a of apps) {
      const d = toVN(a.created_at)
      if (!appDaily[d]) appDaily[d] = { count: 0, real: 0, users: new Set() }
      appDaily[d].count++
      appDaily[d].users.add(applicantKey(a))
      const side = realAgg[isRealJob(a) ? 'real' : 'fake']
      side.count++
      side.users.add(applicantKey(a))
      if (isRealJob(a)) appDaily[d].real++
      const jsrc = a.jobs?.source || '(unknown)'
      jobSourceMap[jsrc] = (jobSourceMap[jsrc] || 0) + 1
      const src = a.application_source || '(unknown)'
      appSourceMap[src] = (appSourceMap[src] || 0) + 1
      const st = a.status || 'applied'
      appStatusMap[st] = (appStatusMap[st] || 0) + 1
      const jk = `${a.jobs?.company || '—'}|${a.jobs?.title || '—'}`
      if (!jobMap[jk]) jobMap[jk] = { company: a.jobs?.company || '—', title: a.jobs?.title || '—', source: a.jobs?.source || '(unknown)', count: 0, accepted: 0 }
      jobMap[jk].count++
      if (a.status === 'accepted') jobMap[jk].accepted++
    }

    // 지원 횟수 분포 — n번 지원한 사람이 몇 명인지 (10회 이상은 '10+' 버킷)
    const perUser = {}
    for (const a of apps) {
      const k = applicantKey(a)
      perUser[k] = (perUser[k] || 0) + 1
    }
    const distMap = {}
    for (const n of Object.values(perUser)) {
      const b = n >= 10 ? '10+' : String(n)
      distMap[b] = (distMap[b] || 0) + 1
    }
    const applyDist = Object.entries(distMap)
      .map(([bucket, users]) => ({ bucket, users }))
      .sort((a, b) => (a.bucket === '10+' ? 10 : +a.bucket) - (b.bucket === '10+' ? 10 : +b.bucket))

    // ── 합격 (기간 내 지원 중 status=accepted) ──
    const acceptedApps = apps.filter(a => a.status === 'accepted')
    const acceptedDaily = {}
    for (const a of acceptedApps) {
      const d = toVN(a.created_at)
      acceptedDaily[d] = (acceptedDaily[d] || 0) + 1
    }

    // 여정 이벤트 카운트 — idx_events_event_created_at 인덱스를 타는 head-count 병렬 쿼리
    const journey = Object.fromEntries(await Promise.all(JOURNEY_EVENTS.map(async ev => {
      const { count } = await supabase.from('events')
        .select('id', { count: 'exact', head: true })
        .eq('event', ev).gte('created_at', startISO).lte('created_at', endISO)
      return [ev, count || 0]
    })))

    const sortDesc = (m) => Object.entries(m).map(([k, count]) => ({ key: k, count })).sort((a, b) => b.count - a.count)

    res.status(200).json({
      journey,
      signups: {
        total: signupUsers.length,
        daily: signupDaily,
        bySource: sortDesc(signupSourceMap),
      },
      applications: {
        total: apps.length,
        uniqueUsers: new Set(apps.map(applicantKey)).size,
        daily: Object.fromEntries(Object.entries(appDaily).map(([d, v]) => [d, { count: v.count, real: v.real, users: v.users.size }])),
        bySource: sortDesc(appSourceMap),
        byStatus: sortDesc(appStatusMap),
        byJobSource: sortDesc(jobSourceMap),
        realFake: {
          real: { count: realAgg.real.count, users: realAgg.real.users.size },
          fake: { count: realAgg.fake.count, users: realAgg.fake.users.size },
        },
        applyDist,
        topJobs: Object.values(jobMap).sort((a, b) => b.count - a.count).slice(0, 15),
      },
      accepted: {
        total: acceptedApps.length,
        uniqueUsers: new Set(acceptedApps.map(applicantKey)).size,
        daily: acceptedDaily,
        items: acceptedApps.map(a => ({
          date: toVN(a.created_at),
          company: a.jobs?.company || '—',
          title: a.jobs?.title || '—',
          source: a.application_source || '(unknown)',
        })).reverse(),
      },
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
