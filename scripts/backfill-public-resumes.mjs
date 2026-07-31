// 구조화 필드(연차/학교)가 비어 "미상"으로 뜨는 이력서를 지금 일괄 파싱.
// cron/parse-public-resumes 와 동일 로직(lib/parseResume) — 백로그 1회 정리용.
//   node scripts/backfill-public-resumes.mjs [--limit N] [--dry] [--all] [--include-private]
// --all: 전체 재파싱(요약 양식 변경 시). updated_at은 안 건드림(지표 착시 방지).
// --include-private: 비공개 이력서까지 — 파싱 결과는 우리가 공고를 매칭해 콜드메일 보낼 때 쓰므로
//   공개 여부와 무관하게 가치가 있다(오히려 비공개가 콜드메일 대상).
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
const all = args.includes('--all')
const includePrivate = args.includes('--include-private')
const li = args.indexOf('--limit')
const limit = li >= 0 ? parseInt(args[li + 1]) : all ? 500 : 100

const { parseResumeForUser, findPublicUnparsed } = await import('../lib/parseResume.js')

const ids = await findPublicUnparsed(limit, all, { includePrivate })
console.log(`파싱 대상(${includePrivate ? '공개+비공개' : '공개'}${all ? '·전체' : '·필드 빈'}): ${ids.length}명`)
if (dry) { console.log(ids); process.exit(0) }

let ok = 0, fail = 0
for (const id of ids) {
  try {
    // 백로그 정리라 updated_at은 항상 보존한다 — admin/dashboard가 이력서풀을 updated_at으로
    // 버킷팅해서, 옛 프로필을 지금 파싱하면 오늘 신규가 쏟아진 것처럼 보인다(7/14 착시와 같은 원인).
    const u = await parseResumeForUser(id, { touchUpdatedAt: false })
    ok++
    console.log(`  ✓ ${id.slice(0, 8)} · ${u.university || '(학교?)'} · ${u.yoe_months ?? '?'}m · ${u.position || '?'}`)
  } catch (e) {
    fail++
    console.log(`  ✗ ${id.slice(0, 8)}: ${e.message}`)
  }
}
console.log(`\n완료: 성공 ${ok} / 실패 ${fail}`)
