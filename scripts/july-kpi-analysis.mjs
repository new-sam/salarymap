// 7월 KPI 현황 분석
//   KPI1: 일 평균 신규 가입자 100명 (web/app split)
//   KPI2: 기업 고객 공고(source=company_self) 당 30개 지원 (D+7 기준)
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { isExcludedSignup } from '../lib/admin-metrics.js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const ICT = '+07:00'
const fmt = n => n.toFixed(1)

// ---------- 공통: 전체 유저 로딩 ----------
async function listAllUsers() {
  const out = []; let p = 1
  while (true) {
    const { data: { users } } = await supabase.auth.admin.listUsers({ page: p, perPage: 1000 })
    if (!users?.length) break
    out.push(...users)
    if (users.length < 1000) break
    p++
  }
  return out
}

// 유저별 첫 이벤트 platform (web/app)
async function platformMap(userIds) {
  const map = {}
  for (let i = 0; i < userIds.length; i += 200) {
    const chunk = userIds.slice(i, i + 200)
    const { data } = await supabase.from('events')
      .select('user_id, meta, created_at')
      .in('user_id', chunk)
      .order('created_at', { ascending: true })
    for (const e of data || []) {
      if (!map[e.user_id]) map[e.user_id] = e.meta?.platform === 'app' ? 'app' : 'web'
    }
  }
  return map
}

// ---------- KPI1: 신규 가입 ----------
async function kpiSignups() {
  const users = await listAllUsers()
  const real = users.filter(u => !isExcludedSignup(u))
  // 7/1 ~ 오늘(7/8) 일별
  const days = []
  for (let d = 1; d <= 8; d++) {
    const ds = `2026-07-0${d}`
    const start = new Date(`${ds}T00:00:00${ICT}`).toISOString()
    const end = new Date(`${ds}T23:59:59${ICT}`).toISOString()
    const ids = real.filter(u => u.created_at >= start && u.created_at <= end).map(u => u.id)
    days.push({ ds, ids })
  }
  // platform split (전체 대상 유저 한 번에)
  const allIds = [...new Set(days.flatMap(d => d.ids))]
  const pm = await platformMap(allIds)
  console.log('\n=== KPI1: 일 신규 가입자 (목표 100명/일) ===')
  let totWeb = 0, totApp = 0, totAll = 0, counted = 0
  for (const { ds, ids } of days) {
    let web = 0, app = 0
    for (const id of ids) (pm[id] === 'app' ? app++ : web++)
    totWeb += web; totApp += app; totAll += ids.length; counted++
    console.log(`  ${ds}: ${String(ids.length).padStart(3)}명  (web ${String(web).padStart(3)} / app ${String(app).padStart(3)})`)
  }
  console.log(`  ------------------------------------------`)
  console.log(`  7월 누적: ${totAll}명  (web ${totWeb} / app ${totApp})`)
  console.log(`  일 평균: ${fmt(totAll / counted)}명/일  (web ${fmt(totWeb / counted)} / app ${fmt(totApp / counted)})`)
  console.log(`  달성률(전체): ${fmt(totAll / counted / 100 * 100)}%  (목표 100명/일)`)
}

// ---------- KPI2: 기업 공고 D+7 지원 ----------
async function kpiEnterpriseApps() {
  const { data: jobs } = await supabase.from('jobs')
    .select('id, title, company, source, status, is_active, created_at')
    .eq('source', 'company_self')
    .order('created_at', { ascending: true })

  // ⚠️ 페이지네이션 필수 (1000행 초과 시 최근 지원 누락 → KPI2 축소)
  const apps = []
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from('job_applications')
      .select('job_id, created_at, platform')
      .order('created_at', { ascending: true }).range(from, from + 999)
    if (!data?.length) break
    apps.push(...data)
    if (data.length < 1000) break
  }

  const byJob = {}
  for (const a of apps || []) {
    if (!byJob[a.job_id]) byJob[a.job_id] = []
    byJob[a.job_id].push(a)
  }

  // 자사(LIKELION) 공고는 기업 "고객" 지표에서 제외.
  const customerJobs = (jobs || []).filter(j => !(j.company || '').toLowerCase().includes('likelion'))

  const nowMs = Date.now()
  console.log('\n=== KPI2: 기업 공고 당 지원수 (목표 30건/공고 · D+7) ===')
  console.log(`  기업 고객 공고(company_self, LIKELION 제외) 총 ${customerJobs.length}건`)

  const matured = []   // D+7 경과한 공고
  const young = []     // 아직 7일 안 지난 공고
  for (const j of customerJobs) {
    const createdMs = new Date(j.created_at).getTime()
    const ageDays = (nowMs - createdMs) / 864e5
    const d7End = createdMs + 7 * 864e5
    const list = byJob[j.id] || []
    const appsD7 = list.filter(a => new Date(a.created_at).getTime() <= d7End).length
    const appsTotal = list.length
    const rec = { ...j, ageDays, appsD7, appsTotal }
    if (ageDays >= 7) matured.push(rec); else young.push(rec)
  }

  const avg = arr => arr.length ? arr.reduce((s, r) => s + r.appsD7, 0) / arr.length : 0
  console.log(`\n  [D+7 경과 공고 ${matured.length}건 — KPI 측정 대상]`)
  for (const r of matured) {
    console.log(`    #${r.id} ${(r.company || '?').slice(0, 20).padEnd(20)} D+7지원 ${String(r.appsD7).padStart(3)} (누적 ${r.appsTotal}, ${Math.floor(r.ageDays)}일차) ${r.is_active ? '' : '[비활성]'}`)
  }
  console.log(`    → D+7 평균 지원수: ${fmt(avg(matured))}건/공고  (목표 30)`)
  console.log(`    → 달성률: ${fmt(avg(matured) / 30 * 100)}%`)

  console.log(`\n  [아직 D+7 미도달 공고 ${young.length}건 — 진행중]`)
  for (const r of young) {
    console.log(`    #${r.id} ${(r.company || '?').slice(0, 20).padEnd(20)} 현재지원 ${String(r.appsTotal).padStart(3)} (${fmt(r.ageDays)}일차)`)
  }
}

await kpiSignups()
await kpiEnterpriseApps()
