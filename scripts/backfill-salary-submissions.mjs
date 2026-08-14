// 수집한 현/직전연봉(user_profiles.current_salary) → 연봉 통계(submissions) 백필.
// /api/salary-update 훅(배포 후 신규 입력은 자동 append)과 같은 파생 로직(lib/salarySubmission.js).
//
// 대상: current_salary 보유 전원 − 이미 source='talent' 파생 행이 있는 유저(재실행 안전).
// 현재/직전 구분은 coldmail_salary_fill 이벤트의 최신 meta.type — current면 이력서의
// 재직중(Present) 회사, previous면 최근 종료 회사를 붙인다. 구분 미상은 회사 없이 직군×연차만.
// 회사명은 submit.js와 동일하게 canonicalCompanyName 통과 + companies 자동 등록(tier 4).
//
//   node scripts/backfill-salary-submissions.mjs           # dry-run: 집계만
//   node scripts/backfill-salary-submissions.mjs --apply   # 실제 insert
import { sb, fetchAll } from './outreach/lib.mjs'
import { deriveSalarySubmission } from '../lib/salarySubmission.js'
import { canonicalCompanyName } from '../lib/canonicalCompany.js'

const APPLY = process.argv.includes('--apply')

const profs = await fetchAll(() =>
  sb.from('user_profiles')
    .select('id, current_salary, position, yoe_months, experiences')
    .not('current_salary', 'is', null)
    .order('id')
)

// 유저별 최신 fill의 current/previous 구분
const fills = await fetchAll(() =>
  sb.from('events')
    .select('user_id, meta, created_at')
    .eq('event', 'coldmail_salary_fill')
    .order('created_at', { ascending: false })
)
const typeByUser = new Map()
for (const e of fills) {
  if (!typeByUser.has(e.user_id)) typeByUser.set(e.user_id, e.meta?.type || null)
}

// 이미 파생된 유저는 건너뛴다(백필 재실행 안전 — 훅 append와는 별개)
const existing = await fetchAll(() =>
  sb.from('submissions').select('user_id').eq('source', 'talent').order('id')
)
const done = new Set(existing.map((r) => r.user_id))

const rows = []
const stat = { total: profs.length, alreadyDerived: 0, skippedInvalid: 0, withCompany: 0 }
const roleDist = {}
for (const p of profs) {
  if (done.has(p.id)) { stat.alreadyDerived++; continue }
  const sub = deriveSalarySubmission(p, typeByUser.get(p.id) || null)
  if (!sub) { stat.skippedInvalid++; continue }
  if (sub.company) stat.withCompany++
  roleDist[sub.role] = (roleDist[sub.role] || 0) + 1
  rows.push({ ...sub, user_id: p.id, source: 'talent' })
}

console.log(JSON.stringify(stat, null, 2))
console.log('insert 예정:', rows.length, '행 (회사 붙는 행:', stat.withCompany + ')')
console.log('직군 분포:', JSON.stringify(Object.fromEntries(Object.entries(roleDist).sort((a, b) => b[1] - a[1]))))

if (!APPLY) {
  console.log('\ndry-run — 실제 insert는 --apply')
  process.exit(0)
}

// 회사명 canonical 처리(고유 이름당 1회 조회) 후 chunk insert
const canonical = new Map()
for (const name of new Set(rows.map((r) => r.company).filter(Boolean))) {
  canonical.set(name, await canonicalCompanyName(name))
}
for (const r of rows) r.company = r.company ? canonical.get(r.company) : null

for (let i = 0; i < rows.length; i += 500) {
  const chunk = rows.slice(i, i + 500)
  const { error } = await sb.from('submissions').insert(chunk)
  if (error) throw error
  console.log(`insert ${i + chunk.length}/${rows.length}`)
}

const companies = [...new Set(rows.map((r) => r.company).filter(Boolean))].map((name) => ({ name, tier: 4 }))
if (companies.length) {
  const { error } = await sb.from('companies').upsert(companies, { onConflict: 'name', ignoreDuplicates: true })
  if (error) throw error
  console.log('companies upsert:', companies.length)
}
console.log('완료')
