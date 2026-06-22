// 한 자리에서 admin UI 위치별 정의와 슬랙봇 코드의 정의를 같은 데이터에
// 적용. 결과가 같으면 슬랙봇이 admin 과 매칭한다는 뜻.
//
// admin UI 위치별 정의:
//   - 오늘 카드 = admin/realtime endpoint (events count for resume)
//   - 일별 행 (어제) = admin/dashboard.js (API) 의 dailyMap (user_profiles)
//   - 누적 카드 = data.summary + today realtime diff (특정 키만)
//     · sessions/companies/resumeUploads 는 diff 안 더함

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import {
  PAID_SOURCES,
  isExcludedSubmission,
  dedupeSubmissions,
  isExcludedSignup,
} from '../lib/admin-metrics.js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const CAMPAIGN_START = '2026-04-20'
const yesterday = '2026-06-21'
const today = '2026-06-22'

const startToday = new Date(`${today}T00:00:00+07:00`).toISOString()
const endToday = new Date(`${today}T23:59:59+07:00`).toISOString()
const startYesterday = new Date(`${yesterday}T00:00:00+07:00`).toISOString()
const endYesterday = new Date(`${yesterday}T23:59:59+07:00`).toISOString()
const startCum = new Date(`${CAMPAIGN_START}T00:00:00+07:00`).toISOString()

async function listAllUsers() {
  const out = []; let p = 1
  while (true) {
    const { data: { users }, error } = await supabase.auth.admin.listUsers({ page: p, perPage: 1000 })
    if (error || !users?.length) break
    out.push(...users)
    if (users.length < 1000) break
    p++
  }
  return out
}

async function fetchSubmissions(start, end) {
  const out = []; let from = 0
  while (true) {
    const { data, error } = await supabase.from('submissions')
      .select('source, company, email, user_id, created_at')
      .eq('is_seed', false)
      .gte('created_at', start).lte('created_at', end)
      .order('created_at', { ascending: true })
      .range(from, from + 999)
    if (error) throw error
    out.push(...(data || []))
    if (!data || data.length < 1000) break
    from += 1000
  }
  return out
}

const inRange = (iso, s, e) => {
  const t = new Date(iso).getTime()
  return t >= new Date(s).getTime() && t <= new Date(e).getTime()
}

// === fetch ===
const allUsers = await listAllUsers()
const cumSubs = await fetchSubmissions(startCum, endToday)
const cumDeduped = dedupeSubmissions(cumSubs.filter(s => !isExcludedSubmission(s)))

// === 오늘 카드 (admin UI 오늘 카드 = admin/realtime endpoint) ===
const todaySubs = cumDeduped.filter(s => inRange(s.created_at, startToday, endToday))
const todayAd = todaySubs.filter(s => PAID_SOURCES.has(s.source)).length
const { count: todayJobApps } = await supabase.from('job_applications').select('id', { count: 'exact', head: true }).gte('created_at', startToday).lte('created_at', endToday)
const { count: todayResumeEvents } = await supabase.from('events').select('id', { count: 'exact', head: true }).in('event', ['cv_register_success', 'resume_upload']).gte('created_at', startToday).lte('created_at', endToday)
const todayCard = {
  submissions: todaySubs.length,
  ad: todayAd,
  organic: todaySubs.length - todayAd,
  companies: new Set(todaySubs.map(s => s.company?.trim().toLowerCase()).filter(Boolean)).size,
  signups: allUsers.filter(u => !isExcludedSignup(u) && inRange(u.created_at, startToday, endToday)).length,
  jobApps: todayJobApps || 0,
  resumeUploads: todayResumeEvents || 0,
}

// === 일별 행 어제 (admin UI 일별 = admin/dashboard.js dailyMap) ===
const yestSubs = cumDeduped.filter(s => inRange(s.created_at, startYesterday, endYesterday))
const yestAd = yestSubs.filter(s => PAID_SOURCES.has(s.source)).length
const { count: yestJobApps } = await supabase.from('job_applications').select('id', { count: 'exact', head: true }).gte('created_at', startYesterday).lte('created_at', endYesterday)
const { count: yestResumeProfile } = await supabase.from('user_profiles').select('id', { count: 'exact', head: true }).not('resume_url', 'is', null).gte('updated_at', startYesterday).lte('updated_at', endYesterday)
const yestRow = {
  submissions: yestSubs.length,
  ad: yestAd,
  organic: yestSubs.length - yestAd,
  companies: new Set(yestSubs.map(s => s.company?.trim().toLowerCase()).filter(Boolean)).size,
  signups: allUsers.filter(u => !isExcludedSignup(u) && inRange(u.created_at, startYesterday, endYesterday)).length,
  jobApps: yestJobApps || 0,
  resumeUploads: yestResumeProfile || 0,
}

// === 누적 카드 (admin UI 누적 카드 = base + today realtime diff, set 메트릭은 base 만) ===
const cumAd = cumDeduped.filter(s => PAID_SOURCES.has(s.source)).length
const cumDedupedYest = cumDeduped.filter(s => inRange(s.created_at, startCum, endYesterday))
const cumCompanies = new Set(cumDedupedYest.map(s => s.company?.trim().toLowerCase()).filter(Boolean)).size
const cumSignups = allUsers.filter(u => !isExcludedSignup(u) && inRange(u.created_at, startCum, endToday)).length
const { count: cumJobApps } = await supabase.from('job_applications').select('id', { count: 'exact', head: true }).gte('created_at', startCum).lte('created_at', endToday)
const { count: cumResume } = await supabase.from('user_profiles').select('id', { count: 'exact', head: true }).not('resume_url', 'is', null)
const cumCard = {
  submissions: cumDeduped.length,
  ad: cumAd,
  organic: cumDeduped.length - cumAd,
  signups: cumSignups,
  jobApps: cumJobApps || 0,
  resumeUploads: cumResume || 0,
  companies: cumCompanies,
}

const rows = (obj) =>
  Object.entries(obj).map(([k, v]) => `  ${k.padEnd(16)} ${String(v).padStart(8)}`).join('\n')

console.log('================================================')
console.log('admin UI 가 화면에 표시하는 값 (= 슬랙봇이 보내야 할 값)')
console.log('================================================')
console.log(`\n[오늘 카드 / Today — ${today}]\n${rows(todayCard)}`)
console.log(`\n[일별 행 / Daily — ${yesterday}]\n${rows(yestRow)}`)
console.log(`\n[전체 기간 누적 / All-time — ${CAMPAIGN_START} ~ ${today}]\n${rows(cumCard)}`)
console.log(`  ※ sessions 는 GA4 라 별도 (admin = ga4.totals.sessions, 4/20~yesterday)`)
