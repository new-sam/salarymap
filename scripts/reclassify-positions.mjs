// 이력서는 있는데 직군이 'Other'/빈값인 프로필의 position 을 재분류.
// 원인: 옛 파서 프롬프트의 position 후보가 개발 9개 + Other 뿐이라 마케팅·영업·재무 등
// 비개발 이력서가 전부 Other로 떨어졌다(이력서 보유 689명 중 213명). 사람이 안 적은 게 아니다.
//
// PDF를 다시 받지 않고 이미 저장된 headline/경력/스킬만 LLM에 넣어 position 하나만 갱신한다.
// 다른 필드는 건드리지 않고 updated_at도 안 올린다(이력서풀 지표 착시 방지).
//   node scripts/reclassify-positions.mjs [--dry] [--limit N]
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
const OpenAI = (await import('openai')).default
const { ROLE_OPTIONS } = await import('../constants/jobs.js')
const { ROLE_ENUM } = await import('../lib/parseResume.js') // 파서와 같은 직군 목록을 쓴다
const { isExcludedSignup } = await import('../lib/admin-metrics.js')

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// LLM이 대소문자를 흘리는 경우가 있어 canonical 표기로 되돌린다.
const CANON = new Map(ROLE_OPTIONS.map((v) => [v.toLowerCase(), v]))

const PROMPT = `You classify a job candidate into exactly one role.

Pick the single value that matches what the person actually does day to day — not the tools they happen to mention. A marketer who edits landing pages is Marketing, not Fullstack. An accountant who writes Excel macros is Finance. A QC inspector in a factory is QC.

Choose EXACTLY one value from this list: ${ROLE_ENUM}

Use "Non-IT" only when the person is clearly non-IT and no other value fits.
Return JSON: {"position": "<one value from the list>", "confidence": "high"|"low"}
If the input is too thin to tell (no title, no experience), return {"position": "", "confidence": "low"}.`

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

const rows = await fetchAll(() => supabase.from('user_profiles')
  .select('id, email, position, headline, major, skills, experiences, is_resume_public')
  .not('resume_url', 'is', null))

const needsRole = (r) => {
  const p = String(r.position || '').trim()
  return !p || p.toLowerCase() === 'other'
}
const describe = (r) => [
  r.headline ? `Headline: ${r.headline}` : '',
  r.major ? `Major: ${r.major}` : '',
  (r.experiences || []).length
    ? `Experience:\n${(r.experiences || []).slice(0, 4).map((e) => `- ${e?.title || '?'} @ ${e?.company || '?'}`).join('\n')}`
    : '',
  (r.skills || []).length ? `Skills: ${(r.skills || []).slice(0, 15).join(', ')}` : '',
].filter(Boolean).join('\n')

const all = rows.filter((r) => !isExcludedSignup(r) && needsRole(r))
// 이력서가 아직 파싱 안 돼 headline/경력이 통째로 빈 프로필은 이 스크립트로 못 고친다
// (PDF 파싱이 선행돼야 함) — 세어서 알리고 대상에서 뺀다.
const noText = all.filter((r) => !describe(r).trim())
const targets = all.filter((r) => describe(r).trim()).slice(0, limit)
console.log(`재분류 대상: ${targets.length}명 (공개 ${targets.filter((r) => r.is_resume_public).length}명)`)
if (noText.length) {
  console.log(`⚠️ 이력서 미파싱으로 제외: ${noText.length}명 (공개 ${noText.filter((r) => r.is_resume_public).length}명) — PDF 파싱이 먼저 필요`)
}

async function classify(r) {
  const text = describe(r)
  if (!text.trim()) return { skip: 'no_text' }
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: PROMPT }, { role: 'user', content: text }],
    temperature: 0,
  })
  const out = JSON.parse(completion.choices[0].message.content)
  const value = CANON.get(String(out.position || '').trim().toLowerCase())
  if (!value) return { skip: 'unmatched', raw: out.position }
  return { value, confidence: out.confidence }
}

// 되돌릴 수 있게 이전 값을 남긴다(전부 'Other'/빈값이라 정보량은 없지만 오분류 시 복구용).
if (!dry && targets.length) {
  const path = new URL(`./reclassify-backup-${new Date().toISOString().slice(0, 10)}.json`, import.meta.url)
  writeFileSync(path, JSON.stringify(targets.map((r) => ({ id: r.id, position: r.position || '' })), null, 1))
  console.log(`백업: ${path.pathname.split('/').pop()}`)
}

const stats = { updated: 0, skipped: 0, failed: 0 }
const byRole = {}
const CONCURRENCY = 6

let cursor = 0
async function worker() {
  for (;;) {
    const i = cursor++
    if (i >= targets.length) return
    const r = targets[i]
    try {
      const res = await classify(r)
      if (res.skip) {
        stats.skipped++
        if (process.env.VERBOSE) console.log(`  skip(${res.skip}) ${r.email}${res.raw ? ` raw=${res.raw}` : ''}`)
        continue
      }
      byRole[res.value] = (byRole[res.value] || 0) + 1
      if (!dry) {
        const { error } = await supabase.from('user_profiles').update({ position: res.value }).eq('id', r.id)
        if (error) throw error
      }
      stats.updated++
      if (stats.updated % 25 === 0) console.log(`  ...${stats.updated}건 처리`)
    } catch (e) {
      stats.failed++
      console.log(`  실패 ${r.email}: ${e.message}`)
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker))

console.log(`\n${dry ? '[dry] ' : ''}갱신 ${stats.updated} · 건너뜀 ${stats.skipped} · 실패 ${stats.failed}`)
console.log('분류 결과:', Object.entries(byRole).sort((a, b) => b[1] - a[1]))
