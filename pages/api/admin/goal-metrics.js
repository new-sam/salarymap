import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'
import { isExcludedSignup } from '../../../lib/admin-metrics'

// 개인용 "목표지표 - Sean" 탭 데이터. 어드민 인증 위에 개인 비밀번호를 한 겹 더 건다.
// 비번은 클라 번들에 안 나가도록 서버에서만 검증한다(헤더 x-goal-pass).
const GOAL_PASSWORD = process.env.GOAL_METRICS_PASSWORD || 'wsj11029'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

// 이번 달 목표
const SIGNUP_TARGET_PER_DAY = 100
const APPS_TARGET_PER_POST = 30 // D+7 기준

// VN(UTC+7) 기준 'YYYY-MM-DD'
const ICT_OFFSET_MS = 7 * 60 * 60 * 1000
const vnParts = (ms) => new Date(ms + ICT_OFFSET_MS).toISOString().slice(0, 10)

async function listAllUsers() {
  const out = []
  let p = 1
  while (true) {
    const { data } = await supabase.auth.admin.listUsers({ page: p, perPage: 1000 })
    const users = data?.users || []
    if (!users.length) break
    out.push(...users)
    if (users.length < 1000) break
    p++
  }
  return out
}

// 유저별 첫 이벤트 platform (web/app). dump-signup-platform.mjs와 동일 휴리스틱.
// (가입 시점 sign_up 이벤트가 쌓이면 그걸 우선하도록 개선 가능)
async function platformMap(userIds) {
  const map = {}
  for (let i = 0; i < userIds.length; i += 200) {
    const chunk = userIds.slice(i, i + 200)
    const { data } = await supabase
      .from('events')
      .select('user_id, meta, created_at')
      .in('user_id', chunk)
      .order('created_at', { ascending: true })
    for (const e of data || []) {
      if (!map[e.user_id]) map[e.user_id] = e.meta?.platform === 'app' ? 'app' : 'web'
    }
  }
  return map
}

async function signupKpi() {
  const users = await listAllUsers()
  const real = users.filter((u) => !isExcludedSignup(u))

  // 이번 달 1일 00:00 (VN) ~ 지금
  const nowMs = Date.now()
  const vnToday = vnParts(nowMs) // YYYY-MM-DD
  const monthStr = vnToday.slice(0, 7) // YYYY-MM
  const [y, m] = monthStr.split('-').map(Number)
  const todayDom = Number(vnToday.slice(8, 10))

  const days = []
  for (let d = 1; d <= todayDom; d++) {
    const ds = `${monthStr}-${String(d).padStart(2, '0')}`
    const start = new Date(`${ds}T00:00:00+07:00`).toISOString()
    const end = new Date(`${ds}T23:59:59.999+07:00`).toISOString()
    const ids = real.filter((u) => u.created_at >= start && u.created_at <= end).map((u) => u.id)
    days.push({ date: ds, ids })
  }

  const allIds = [...new Set(days.flatMap((d) => d.ids))]
  const pm = await platformMap(allIds)

  let totWeb = 0
  let totApp = 0
  let tot = 0
  const daily = days.map(({ date, ids }) => {
    let web = 0
    let app = 0
    for (const id of ids) pm[id] === 'app' ? app++ : web++
    totWeb += web
    totApp += app
    tot += ids.length
    return { date, total: ids.length, web, app }
  })

  const nDays = days.length || 1
  return {
    target: SIGNUP_TARGET_PER_DAY,
    month: monthStr,
    daysElapsed: nDays,
    totals: { all: tot, web: totWeb, app: totApp },
    avgPerDay: { all: tot / nDays, web: totWeb / nDays, app: totApp / nDays },
    achievementPct: (tot / nDays / SIGNUP_TARGET_PER_DAY) * 100,
    daily,
  }
}

async function enterpriseAppsKpi() {
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, title, company, source, is_active, created_at')
    .eq('source', 'company_self')
    .order('created_at', { ascending: true })

  // 자사(LIKELION) 공고는 기업 "고객" 지표에서 제외 — 내부 테스트/자사 등록이라 KPI 오염.
  const customerJobs = (jobs || []).filter((j) => !(j.company || '').toLowerCase().includes('likelion'))

  const { data: apps } = await supabase.from('job_applications').select('job_id, created_at')

  const byJob = {}
  for (const a of apps || []) (byJob[a.job_id] ||= []).push(a)

  const nowMs = Date.now()
  const matured = []
  const young = []
  for (const j of customerJobs) {
    const createdMs = new Date(j.created_at).getTime()
    const ageDays = (nowMs - createdMs) / 864e5
    const d7End = createdMs + 7 * 864e5
    const list = byJob[j.id] || []
    const appsD7 = list.filter((a) => new Date(a.created_at).getTime() <= d7End).length
    const rec = {
      id: j.id,
      company: j.company || null,
      title: j.title || null,
      isActive: !!j.is_active,
      ageDays: Math.round(ageDays * 10) / 10,
      appsD7,
      appsTotal: list.length,
    }
    ;(ageDays >= 7 ? matured : young).push(rec)
  }

  const avgD7 = matured.length ? matured.reduce((s, r) => s + r.appsD7, 0) / matured.length : 0
  return {
    target: APPS_TARGET_PER_POST,
    totalPosts: customerJobs.length,
    maturedCount: matured.length,
    avgD7,
    achievementPct: (avgD7 / APPS_TARGET_PER_POST) * 100,
    matured: matured.sort((a, b) => b.appsD7 - a.appsD7),
    young: young.sort((a, b) => b.appsTotal - a.appsTotal),
  }
}

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })
  if ((req.headers['x-goal-pass'] || '') !== GOAL_PASSWORD) {
    return res.status(403).json({ error: 'bad_pass' })
  }

  try {
    const [signups, enterpriseApps] = await Promise.all([signupKpi(), enterpriseAppsKpi()])
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ signups, enterpriseApps, generatedAt: new Date().toISOString() })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
