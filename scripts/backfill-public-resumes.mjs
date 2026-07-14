// 공개 인재풀 중 구조화 필드(연차/학교)가 비어 "미상"으로 뜨는 이력서를 지금 일괄 파싱.
// cron/parse-public-resumes 와 동일 로직(lib/parseResume) — 백로그 1회 정리용.
//   node scripts/backfill-public-resumes.mjs [--limit N] [--dry]
import { readFileSync } from 'node:fs'

// lib/parseResume 가 모듈 로드 시 process.env 를 읽으므로 먼저 .env.local 주입
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  if (!line || line.startsWith('#') || !line.includes('=')) continue
  const i = line.indexOf('=')
  const k = line.slice(0, i).trim()
  if (process.env[k] === undefined) process.env[k] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
}

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const li = args.indexOf('--limit')
const limit = li >= 0 ? parseInt(args[li + 1]) : 100

const { parseResumeForUser, findPublicUnparsed } = await import('../lib/parseResume.js')

const ids = await findPublicUnparsed(limit)
console.log(`파싱 대상(공개·필드 빈): ${ids.length}명`)
if (dry) { console.log(ids); process.exit(0) }

let ok = 0, fail = 0
for (const id of ids) {
  try {
    const u = await parseResumeForUser(id)
    ok++
    console.log(`  ✓ ${id.slice(0, 8)} · ${u.university || '(학교?)'} · ${u.yoe_months ?? '?'}m · ${u.position || '?'}`)
  } catch (e) {
    fail++
    console.log(`  ✗ ${id.slice(0, 8)}: ${e.message}`)
  }
}
console.log(`\n완료: 성공 ${ok} / 실패 ${fail}`)
