// 인재풀 전체 AI 파싱 백필 — 어드민 "AI 전체 채우기" 버튼과 같은 대상/동작의 스크립트판
// (브라우저 안 띄워도 되고 중단에 강함). 대상 = 경력회사 또는 요약불릿 빈 인재, parse_failed 제외.
// 실패는 API와 동일하게 resume_summary.parse_failed 마킹, updated_at 안 건드림(지표 착시 방지).
// 스캔 PDF는 vision 폴백(8/5)으로 자동 처리. 멱등. node scripts/backfill-parse-all.mjs
import { sb, fetchAll } from './outreach/lib.mjs'
import { parseResumeForUser } from '../lib/parseResume.js'

const rows = await fetchAll(() => sb
  .from('user_profiles')
  .select('id, experiences, resume_summary')
  .not('resume_url', 'is', null)
  .neq('resume_url', '')
)
const targets = rows.filter(r => {
  if (r.resume_summary?.parse_failed) return false
  const hasCompany = Array.isArray(r.experiences) && r.experiences.some(e => e?.company)
  const bullets = r.resume_summary?.bullets
  return !hasCompany || !Array.isArray(bullets) || bullets.length === 0
})
console.log(`이력서 보유 ${rows.length} / 파싱 대상 ${targets.length}`)

let ok = 0, fail = 0, done = 0
const CONCURRENCY = 4

async function markFailed(userId) {
  try {
    const { data: p } = await sb.from('user_profiles').select('resume_summary').eq('id', userId).single()
    await sb.from('user_profiles').update({ resume_summary: { ...(p?.resume_summary || {}), parse_failed: true } }).eq('id', userId)
  } catch {}
}

async function processOne(r) {
  try {
    await parseResumeForUser(r.id, { touchUpdatedAt: false })
    ok++
  } catch (e) {
    fail++
    await markFailed(r.id)
    if (fail <= 10) console.warn(`  실패 ${r.id}: ${(e.message || '').slice(0, 80)}`)
  } finally {
    done++
    if (done % 25 === 0) console.log(`  ${done}/${targets.length} (성공 ${ok} / 실패 ${fail})`)
  }
}

for (let i = 0; i < targets.length; i += CONCURRENCY) {
  await Promise.all(targets.slice(i, i + CONCURRENCY).map(processOne))
}
console.log(`\n완료: 성공 ${ok} / 실패 ${fail}`)
