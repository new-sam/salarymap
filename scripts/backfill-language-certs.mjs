// 언어 능력(korean_cert/english_cert) 미스캔 이력서 1회 백필.
// 대상 = 이력서 보유 && korean_cert IS NULL (언어 필드가 없던 옛 프롬프트 파싱분 + 미파싱분).
//   · 이미 파싱된 프로필(연차/학교 있음) → 언어 2필드만 갱신(수기입력·기존 파싱값 보존)
//   · 미파싱 프로필 → 전체 필드 갱신 (updated_at은 안 건드림 — 지표 착시 방지)
//   node scripts/backfill-language-certs.mjs [--limit N] [--dry]
import { readFileSync } from 'node:fs'

for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  if (!line || line.startsWith('#') || !line.includes('=')) continue
  const i = line.indexOf('=')
  const k = line.slice(0, i).trim()
  if (process.env[k] === undefined) process.env[k] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
}

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const li = args.indexOf('--limit')
const limit = li >= 0 ? parseInt(args[li + 1]) : 500

const { createClient } = await import('@supabase/supabase-js')
const { parseResumeBuffer, preserveUserEntered } = await import('../lib/parseResume.js')
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data: targets, error } = await supabase
  .from('user_profiles')
  .select('id, full_name, resume_url, yoe_months, university, english_cert, korean_cert, position')
  .not('resume_url', 'is', null)
  .neq('resume_url', '') // 빈 문자열 url 은 not.is.null 을 통과해버림
  .is('korean_cert', null)
  .limit(limit)
if (error) throw error

const alreadyParsed = (p) => p.yoe_months !== null || (p.university || '').trim()
console.log(`대상 ${targets.length}명 (언어만 갱신 ${targets.filter(alreadyParsed).length} / 전체 갱신 ${targets.filter(p => !alreadyParsed(p)).length})`)
if (dry) process.exit(0)

let ok = 0, fail = 0
const failReasons = {}

async function processOne(p) {
  try {
    const fileRes = await fetch(p.resume_url)
    if (!fileRes.ok) throw new Error(`download ${fileRes.status}`)
    const buffer = Buffer.from(await fileRes.arrayBuffer())
    const parsed = await parseResumeBuffer(buffer, p.full_name)
    const update = alreadyParsed(p)
      ? { english_cert: parsed.english_cert, korean_cert: parsed.korean_cert }
      : parsed
    // 대상이 korean_cert IS NULL 이라 '한국어만 빈' 사람도 걸린다. 그 사람의 english_cert 가
    // 사람이 넣은 값(어학 콜드메일 응답 다수가 영어만 채운다)이면 여기서 지워진다.
    const { error: upErr } = await supabase.from('user_profiles')
      .update(preserveUserEntered(update, p)).eq('id', p.id)
    if (upErr) throw new Error(`db: ${upErr.message}`)
    ok++
    if (parsed.korean_cert || parsed.english_cert) console.log(`  ✓ ${p.id.slice(0, 8)} ko="${parsed.korean_cert}" en="${parsed.english_cert}"`)
  } catch (e) {
    fail++
    const msg = String(e.message || e).slice(0, 60)
    failReasons[msg] = (failReasons[msg] || 0) + 1
  }
}

// 4개 동시 — OpenAI/다운로드가 병목이라 순차보다 4배 빠르고 rate limit 은 안 건드림
const queue = [...targets]
await Promise.all(Array.from({ length: 4 }, async () => {
  for (;;) {
    const p = queue.shift()
    if (!p) return
    await processOne(p)
    const done = ok + fail
    if (done % 20 === 0) console.log(`… ${done}/${targets.length} (성공 ${ok} 실패 ${fail})`)
  }
}))

console.log(`\n완료: 성공 ${ok} / 실패 ${fail}`)
for (const [msg, n] of Object.entries(failReasons).sort((a, b) => b[1] - a[1])) console.log(`  ${n}× ${msg}`)
