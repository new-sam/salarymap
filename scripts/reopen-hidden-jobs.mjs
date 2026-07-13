// 7/8 가림 처리(is_active=false)했던 인기 공고들을 외부 사이트 마감 여부 체크 후
// 살아있는 것만 재공개하는 스크립트.
//   dry-run:  node scripts/reopen-hidden-jobs.mjs
//   적용:     node scripts/reopen-hidden-jobs.mjs --apply
// 대상: 비활성 공고 중 7/8 직전 2주(6/24~7/8)에 지원이 발생했던 공고 (company_self 제외)
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const APPLY = process.argv.includes('--apply')
const UA = { 'User-Agent': 'Mozilla/5.0' }
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function checkWanted(job) {
  const r = await fetch(`https://www.wanted.co.kr/api/v4/jobs/${job.source_id}`, { headers: UA })
  if (r.status === 404) return 'closed'
  if (!r.ok) return 'unknown'
  const status = (await r.json()).job?.status
  if (status === 'active') return 'alive'
  if (/close/i.test(status || '')) return 'closed'
  return 'unknown'
}

async function checkTopdev(job) {
  const r = await fetch(`https://api.topdev.vn/td/v2/jobs/${job.source_id}?fields[job]=id,status_display&locale=en`, { headers: UA })
  if (r.status === 404) return 'closed'
  if (!r.ok) return 'unknown'
  const status = (await r.json()).data?.status_display
  if (status === 'Open') return 'alive'
  if (status === 'Closed') return 'closed'
  return 'unknown'
}

// ATS(greenhouse/workable/greetinghr) 등: apply_url 응답 코드로 판별
async function checkByUrl(job) {
  if (!job.apply_url) return 'unknown'
  try {
    const r = await fetch(job.apply_url, { headers: UA, redirect: 'follow' })
    if (r.status === 404 || r.status === 410) return 'closed'
    if (!r.ok) return 'unknown'
    return 'alive'
  } catch {
    return 'unknown'
  }
}

async function checkJob(job) {
  if (job.source === 'wanted') return checkWanted(job)
  if (job.source === 'topdev') return checkTopdev(job)
  return checkByUrl(job)
}

// ---------- 대상 선정 ----------
const { data: recentApps, error: appsErr } = await supabase.from('job_applications')
  .select('job_id')
  .gte('created_at', '2026-06-24T00:00:00+07:00')
  .lt('created_at', '2026-07-08T00:00:00+07:00')
if (appsErr) { console.error(appsErr.message); process.exit(1) }
const recentIds = [...new Set(recentApps.map(a => a.job_id))]

const { data: hidden, error: jobsErr } = await supabase.from('jobs')
  .select('id, title, company, source, source_id, apply_url, deadline')
  .eq('is_active', false)
  .neq('source', 'company_self')
  .in('id', recentIds)
if (jobsErr) { console.error(jobsErr.message); process.exit(1) }
console.log(`대상 공고: ${hidden.length}건 (${APPLY ? '적용 모드' : 'dry-run'})\n`)

// ---------- 마감 체크 ----------
const results = { alive: [], closed: [], unknown: [] }
for (const job of hidden) {
  const verdict = await checkJob(job)
  results[verdict].push(job)
  console.log(`[${verdict.padEnd(7)}] (${job.source}) ${job.company} / ${job.title}`)
  await sleep(300)
}

console.log(`\n=== 결과: 살아있음 ${results.alive.length} / 마감 ${results.closed.length} / 판별불가 ${results.unknown.length} ===`)
if (results.unknown.length) {
  console.log('\n[판별불가 — 수동 확인 필요]')
  for (const j of results.unknown) console.log(`- (${j.source}) ${j.company} / ${j.title}\n  ${j.apply_url || '(apply_url 없음)'}`)
}

// ---------- 재공개 적용 ----------
if (APPLY && results.alive.length) {
  const ids = results.alive.map(j => j.id)
  const { error } = await supabase.from('jobs').update({ is_active: true }).in('id', ids)
  if (error) { console.error('업데이트 실패:', error.message); process.exit(1) }
  console.log(`\n✅ ${ids.length}건 재공개 완료 (is_active=true)`)
} else if (!APPLY) {
  console.log('\ndry-run 완료. 적용하려면 --apply 로 재실행.')
}
