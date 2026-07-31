// 지원서에만 붙어 있던 이력서를 프로필(user_profiles.resume_url)로 옮긴다.
//
// 지원 시 첨부한 이력서는 job_applications.resume_url 에만 저장돼서, 이력서를 낸 사람이
// "이력서 미보유"로 집계됐다(325명). 본인이 우리 플랫폼에 올린 파일이고 다음 지원 때
// 다시 안 올려도 되니 프로필에 붙이는 게 서비스상 맞다.
//
// 건드리는 건 resume_url / resume_source / resume_platform 셋뿐이다.
//  · is_resume_public 은 안 건드림 — 보유(우리가 가짐)와 공개(인재풀 노출)는 별개 동의다.
//  · updated_at 도 안 건드림 — admin/dashboard가 이력서풀을 updated_at으로 버킷팅해서
//    옛 지원서를 지금 옮기면 오늘 325명이 등록한 것처럼 보인다(7/14 착시와 같은 원인).
//  · 이미 프로필에 이력서가 있는 사람은 대상이 아니다(덮어쓰지 않음).
//   node scripts/backfill-profile-resume-from-applications.mjs [--dry] [--limit N]
import { readFileSync, writeFileSync } from 'node:fs'

for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  if (!line || line.startsWith('#') || !line.includes('=')) continue
  const i = line.indexOf('=')
  const k = line.slice(0, i).trim()
  if (process.env[k] === undefined) process.env[k] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
}

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const li = args.indexOf('--limit')
const limit = li >= 0 ? parseInt(args[li + 1]) : Infinity

const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function fetchAll(build) {
  let all = []
  let from = 0
  for (;;) {
    const { data, error } = await build().range(from, from + 999)
    if (error) throw error
    if (!data || !data.length) break
    all = all.concat(data)
    if (data.length < 1000) break
    from += 1000
  }
  return all
}

const [profiles, apps] = await Promise.all([
  fetchAll(() => supabase.from('user_profiles').select('id, email, resume_url')),
  fetchAll(() => supabase.from('job_applications')
    .select('user_id, resume_url, platform, created_at')
    .not('user_id', 'is', null)
    .order('created_at', { ascending: true })),
])

const empty = new Map(profiles.filter((p) => !String(p.resume_url || '').trim()).map((p) => [p.id, p]))
// 오름차순 정렬이라 뒤에 오는 값이 이기게 두면 자연히 '가장 최근 지원서'가 남는다.
const latest = new Map()
for (const a of apps) {
  if (!empty.has(a.user_id) || !String(a.resume_url || '').trim()) continue
  latest.set(a.user_id, a)
}

const targets = [...latest.entries()].slice(0, limit)
console.log(`대상: ${targets.length}명 (프로필 이력서 없음 + 지원서에 이력서 있음)`)
if (!targets.length) process.exit(0)

if (!dry) {
  const path = new URL(`./profile-resume-backfill-backup-${new Date().toISOString().slice(0, 10)}.json`, import.meta.url)
  writeFileSync(path, JSON.stringify(targets.map(([id]) => ({ id, resume_url: empty.get(id).resume_url ?? null })), null, 1))
  console.log(`백업: ${path.pathname.split('/').pop()}`)
}

let ok = 0
let fail = 0
for (const [userId, app] of targets) {
  const row = { resume_url: app.resume_url, resume_source: 'application' }
  if (app.platform === 'app' || app.platform === 'web') row.resume_platform = app.platform
  if (dry) { ok++; continue }
  const { error } = await supabase.from('user_profiles').update(row).eq('id', userId)
  if (error) { fail++; console.log(`  ✗ ${userId.slice(0, 8)}: ${error.message}`) } else ok++
  if (ok % 50 === 0) console.log(`  ...${ok}건`)
}
console.log(`\n${dry ? '[dry] ' : ''}완료: 성공 ${ok} / 실패 ${fail}`)
