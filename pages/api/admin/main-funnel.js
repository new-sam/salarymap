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

// 단계별 이탈 플로우 — 어디서 가장 많이 새는지 보려는 상세 퍼널. 계측이 깨끗한(client_id 스티칭
// 신뢰 가능) 플로우만. 각 단계 이벤트는 순차(funnel RPC)로 이어 전 단계 대비 전환율을 잰다.
// 배제: 공고 브라우징(view_jobs_page/click_job_card/click_apply 60% 무id)·앱(app_open cid 0%)은
//       상단 이벤트가 대부분 익명이라 순차 퍼널이 신뢰 불가 → coverageNote 로만 안내.
const FLOW_FUNNELS = [
  { key: 'wizard', title: ['홈/위저드 → 게이트 → 가입', 'Home/wizard → gate → signup'],
    steps: [
      { event: 'wizard_step_1', label: ['위저드 시작', 'Wizard start'] },
      { event: 'wizard_step_2', label: ['위저드 2', 'Wizard 2'] },
      { event: 'wizard_step_3', label: ['위저드 3', 'Wizard 3'] },
      { event: 'wizard_step_4', label: ['위저드 완료', 'Wizard done'] },
      { event: 'result_gate_view', label: ['게이트 노출', 'Gate view'] },
      { event: 'sign_up', label: ['가입', 'Sign-up'] },   // sign_up 이벤트 = 신규 계정(콜백에서 발화) → 실제 가입
    ] },
  // CV 는 클라이언트 OAuth(서버 콜백 미경유)라 sign_up 이벤트가 스티칭 0 → 종료(가입)를 이벤트 대신
  // "마지막 단계 도달자 중 신규 auth 계정 수"로 잰다(newSignupTerminal). 등록완료 자체엔 기존유저도 섞임.
  { key: 'cv', title: ['CV → 가입', 'CV → signup'],
    steps: [
      { event: 'cv_view', label: ['CV 페이지 뷰', 'CV view'] },
      { event: 'cv_attach_file', label: ['이력서 업로드', 'Resume upload'] },
      { event: 'cv_oauth_start', label: ['로그인 시작', 'Login start'] },
      { event: 'cv_register_success', label: ['이력서 등록', 'Resume registered'] },
    ],
    newSignupTerminal: { fromStep: 'cv_register_success', label: ['가입 (신규)', 'Sign-up (new)'] } },
]

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

    // 단계별 이탈 플로우 — 순차 퍼널(funnel RPC)로 각 단계 도달 유저수 + 전 단계 대비 전환율.
    // 창은 전체 기간(단계 사이 간격이 1일 윈도우로 잘리지 않게), order='this'(직전 단계 이후 도달).
    const rangeWindow = `${Math.max(86400, Math.round((new Date(endISO) - new Date(startISO)) / 1000))} seconds`
    const signupIdSet = new Set(signupUsers.map(u => u.id))  // 기간 내 신규 auth 계정
    const flows = {}
    await Promise.all(FLOW_FUNNELS.map(async ff => {
      const rpcArgs = { p_steps: ff.steps.map(s => ({ event: s.event })), p_from: startISO, p_to: endISO, p_window: rangeWindow, p_order: 'this' }
      const { data, error } = await supabase.rpc('funnel', rpcArgs)
      if (error) { flows[ff.key] = null; return }
      const byIdx = Object.fromEntries((data || []).map(r => [r.step_index, Number(r.users)]))
      const steps = ff.steps.map((s, i) => ({ label: s.label, users: byIdx[i + 1] || 0 }))

      // 신규가입 종료단계 — sign_up 이벤트가 스티칭 안 되는 플로우(CV)용.
      // 마지막 이벤트 단계 도달자(funnel_users) 중, fromStep 이벤트로 user_id 를 얻어 신규 auth 계정인 수.
      if (ff.newSignupTerminal) {
        const { data: fu } = await supabase.rpc('funnel_users', { ...rpcArgs, p_reached: ff.steps.length, p_limit: 5000 })
        const keys = new Set((fu || []).map(r => r.user_key))
        const mapRows = await fetchAll(
          supabase.from('events').select('user_id, client_id')
            .eq('event', ff.newSignupTerminal.fromStep).gte('created_at', startISO).lte('created_at', endISO)
        )
        const key2uid = {}
        for (const r of mapRows) { const k = r.client_id || r.user_id; if (k && r.user_id) key2uid[k] = r.user_id }
        let n = 0
        for (const k of keys) { const uid = key2uid[k]; if (uid && signupIdSet.has(uid)) n++ }
        steps.push({ label: ff.newSignupTerminal.label, users: n })
      }
      flows[ff.key] = { title: ff.title, steps }
    }))

    const sortDesc = (m) => Object.entries(m).map(([k, count]) => ({ key: k, count })).sort((a, b) => b.count - a.count)

    // 실 공고(기업등록+KTC) 건당 지원 — 누적(기간 무관). 활성 공고 수 대비 평균 지원 건수.
    const REAL_SOURCES = ['company_self', 'ktc']
    const [{ count: realActive }, { count: realTotal }, realAppRows] = await Promise.all([
      supabase.from('jobs').select('id', { count: 'exact', head: true }).in('source', REAL_SOURCES).eq('is_active', true),
      supabase.from('jobs').select('id', { count: 'exact', head: true }).in('source', REAL_SOURCES),
      fetchAll(supabase.from('job_applications').select('applicant_email, jobs!inner(company, title, source)').in('jobs.source', REAL_SOURCES)),
    ])
    const cleanReal = realAppRows.filter(a => !isExcludedEmail(a.applicant_email))
    const realPostingSet = new Set(cleanReal.map(a => `${a.jobs.company}|${a.jobs.title}`))
    const realJobs = {
      activePostings: realActive || 0,
      totalPostings: realTotal || 0,
      totalApps: cleanReal.length,
      postingsWithApps: realPostingSet.size,
      avgPerActive: realActive ? cleanReal.length / realActive : null,
      avgPerWithApps: realPostingSet.size ? cleanReal.length / realPostingSet.size : null,
    }

    res.status(200).json({
      flows,
      realJobs,
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
