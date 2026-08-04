// 이력서(PDF/docx)에서 포폴 링크(Behance/Dribbble/GitHub/Drive 등)를 추출해
// resume_summary.links 에 백필. 휴리스틱은 lib/parseResume extractPortfolioLinks 공유.
// 멱등: links 배열이 이미 있는 행(빈 배열 포함=처리됨 마커)은 건너뜀. updated_at 안 건드림.
// node scripts/backfill-cv-links.mjs
import { sb, fetchAll } from './outreach/lib.mjs'
import { extractResumeText, extractPortfolioLinks } from '../lib/parseResume.js'

const rows = await fetchAll(() => sb
  .from('user_profiles')
  .select('id, resume_url, resume_summary')
  .not('resume_url', 'is', null)
  .neq('resume_url', '')
)
const targets = rows.filter(r => !Array.isArray(r.resume_summary?.links))
console.log(`이력서 보유 ${rows.length}명 / links 미처리 ${targets.length}명 → 추출 시작`)

let withLinks = 0, empty = 0, fail = 0, done = 0
const CONCURRENCY = 8

async function processOne(r) {
  try {
    const res = await fetch(r.resume_url)
    if (!res.ok) throw new Error(`download ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    let text = ''
    try { text = await extractResumeText(buf) } catch {} // 스캔PDF 등 텍스트 실패해도 raw 스캔은 진행
    const links = extractPortfolioLinks(text, buf)
    const { error } = await sb.from('user_profiles')
      .update({ resume_summary: { ...(r.resume_summary || {}), links } })
      .eq('id', r.id)
    if (error) throw new Error(`db: ${error.message}`)
    links.length ? withLinks++ : empty++
  } catch (e) {
    fail++
    if (fail <= 5) console.warn(`  실패 ${r.id}: ${e.message}`)
  } finally {
    done++
    if (done % 100 === 0) console.log(`  ${done}/${targets.length} (링크발견 ${withLinks})`)
  }
}

for (let i = 0; i < targets.length; i += CONCURRENCY) {
  await Promise.all(targets.slice(i, i + CONCURRENCY).map(processOne))
}
console.log(`\n완료: 링크발견 ${withLinks} / 링크없음 ${empty} / 실패 ${fail}`)
