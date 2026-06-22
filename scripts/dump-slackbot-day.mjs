// 슬랙봇이 daily 모드로 쏘는 메시지의 raw 숫자를 두 날짜로 dump.
// supabase 식 그대로 (lib/admin-metrics.js + 봇 코드와 동일).
// GA4 sessions 는 별도라 여기 안 포함.

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

async function listAllUsers() {
  const out = []
  let page = 1
  while (true) {
    const { data: { users }, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !users?.length) break
    out.push(...users)
    if (users.length < 1000) break
    page++
  }
  return out
}

async function fetchSubmissions(startUtc, endUtc) {
  const PAGE = 1000
  let from = 0
  const out = []
  while (true) {
    const { data, error } = await supabase
      .from('submissions')
      .select('source, company, email, user_id, created_at')
      .eq('is_seed', false)
      .gte('created_at', startUtc).lte('created_at', endUtc)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    out.push(...(data || []))
    if (!data || data.length < PAGE) break
    from += PAGE
  }
  return out
}

async function dumpDay(date, allUsers) {
  const startUtc = new Date(`${date}T00:00:00+07:00`).toISOString()
  const endUtc = new Date(`${date}T23:59:59+07:00`).toISOString()

  const subs = await fetchSubmissions(startUtc, endUtc)
  const deduped = dedupeSubmissions(subs.filter(r => !isExcludedSubmission(r)))
  const ad = deduped.filter(r => PAID_SOURCES.has(r.source)).length
  const companies = new Set(deduped.map(r => r.company?.trim().toLowerCase()).filter(Boolean)).size

  const signups = allUsers.filter(u => u.created_at >= startUtc && u.created_at <= endUtc && !isExcludedSignup(u)).length

  const { count: jobApps } = await supabase.from('job_applications')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startUtc).lte('created_at', endUtc)

  const { count: resumes } = await supabase.from('events')
    .select('id', { count: 'exact', head: true })
    .in('event', ['cv_register_success', 'resume_upload'])
    .gte('created_at', startUtc).lte('created_at', endUtc)

  return {
    date,
    submissions: deduped.length,
    ad,
    organic: deduped.length - ad,
    companies,
    signups,
    jobApps: jobApps || 0,
    resumes: resumes || 0,
  }
}

const allUsers = await listAllUsers()

const CAMPAIGN_START = '2026-04-20'
const yesterday = '2026-06-22'

const d22 = await dumpDay('2026-06-22', allUsers)
const d21 = await dumpDay('2026-06-21', allUsers)

// 누적 (4/20 ~ 6/22) — 봇의 getCumulative 식 그대로
const cumStartUtc = new Date(`${CAMPAIGN_START}T00:00:00+07:00`).toISOString()
const cumEndUtc = new Date(`${yesterday}T23:59:59+07:00`).toISOString()
const cumSubs = await fetchSubmissions(cumStartUtc, cumEndUtc)
const cumDeduped = dedupeSubmissions(cumSubs.filter(r => !isExcludedSubmission(r)))
const cumAd = cumDeduped.filter(r => PAID_SOURCES.has(r.source)).length
const cumSignups = allUsers.filter(u => u.created_at >= cumStartUtc && u.created_at <= cumEndUtc && !isExcludedSignup(u)).length
const { count: cumJobApps } = await supabase.from('job_applications')
  .select('*', { count: 'exact', head: true })
  .gte('created_at', cumStartUtc).lte('created_at', cumEndUtc)
// 누적 회사 = 4/20~yesterday-1 (= 6/21) — 봇의 비대칭 정의
const yesterday2 = '2026-06-21'
const yesterdayEndMs = new Date(`${yesterday2}T23:59:59+07:00`).getTime()
const cumDedupedToYesterday = cumDeduped.filter(r => new Date(r.created_at).getTime() <= yesterdayEndMs)
const cumCompanies = new Set(cumDedupedToYesterday.map(r => r.company?.trim().toLowerCase()).filter(Boolean)).size
// 누적 이력서 = user_profiles snapshot (시간 무관)
const { count: cumResumes } = await supabase.from('user_profiles')
  .select('id', { count: 'exact', head: true })
  .not('resume_url', 'is', null)

const cum = {
  range: `${CAMPAIGN_START} ~ ${yesterday}`,
  submissions: cumDeduped.length,
  ad: cumAd,
  organic: cumDeduped.length - cumAd,
  signups: cumSignups,
  jobApps: cumJobApps || 0,
  resumes: cumResumes || 0,
  companies: cumCompanies,
}

console.log('=== 6/21 (DoD base) ===')
console.log(d21)
console.log('\n=== 6/22 (yesterday) ===')
console.log(d22)
console.log('\n=== 누적 (4/20 ~ 6/22) ===')
console.log(cum)
