// parse_failed 마커가 붙은 인재를 vision PDF 폴백(8/5 추가)으로 재파싱.
// 성공하면 resume_summary 가 통째로 갱신되며 마커가 자연 해제되고, 실패하면 마커 유지.
// updated_at 은 안 건드림(지표 착시 방지). node scripts/retry-failed-parses.mjs
import { sb, fetchAll } from './outreach/lib.mjs'
import { parseResumeForUser } from '../lib/parseResume.js'

const rows = await fetchAll(() => sb
  .from('user_profiles')
  .select('id, resume_summary')
  .not('resume_url', 'is', null)
  .neq('resume_url', '')
)
const targets = rows.filter(r => r.resume_summary?.parse_failed)
console.log(`parse_failed ${targets.length}명 재시도 (vision PDF 폴백)`)

let ok = 0, fail = 0, done = 0
const CONCURRENCY = 3

async function processOne(r) {
  try {
    await parseResumeForUser(r.id, { touchUpdatedAt: false })
    ok++
  } catch (e) {
    fail++
    if (fail <= 8) console.warn(`  실패 ${r.id}: ${(e.message || '').slice(0, 80)}`)
  } finally {
    done++
    if (done % 10 === 0) console.log(`  ${done}/${targets.length} (성공 ${ok})`)
  }
}

for (let i = 0; i < targets.length; i += CONCURRENCY) {
  await Promise.all(targets.slice(i, i + CONCURRENCY).map(processOne))
}
console.log(`\n완료: 복구 ${ok} / 여전히 실패 ${fail}`)
