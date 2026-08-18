// 인재풀 퀄리티 신호 분포 리포트 (읽기 전용).
// 어드민 인재풀과 동일 모수(resume_url 보유, 내부계정 제외)에서 사진/학벌/어학/경력/포폴/연봉
// 신호가 실제로 얼마나 채워져 있고 어떤 등급 분포인지 집계한다. node scripts/talent-quality-report.mjs
import { sb, fetchAll } from './outreach/lib.mjs'
import { asExperiences } from '../lib/talentCategory.js'
import { isExcludedEmail } from '../lib/admin-metrics.js'
import { schoolBucketOf, enBucketOf, koBucketOf, brandTypesOf } from '../lib/talentQuality.js'

const COLS = 'id, full_name, position, yoe_months, resume_url, photo_url, is_resume_public, skills, university, major, graduation_year, experiences, english_cert, korean_cert, current_salary, resume_summary, verified_school_name, verified_school_tier, created_at'

const rows = await fetchAll(() => sb
  .from('user_profiles').select(COLS)
  .not('resume_url', 'is', null).neq('resume_url', '')
  .order('created_at', { ascending: false }))

// 내부/테스트 계정 제외 — 어드민 /api/admin/resumes 와 동일 규칙
const emails = {}
for (let page = 1; ; page++) {
  const { data: { users }, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
  if (error || !users?.length) break
  for (const u of users) emails[u.id] = u.email
  if (users.length < 1000) break
}
const pool = rows.filter(r => !isExcludedEmail(emails[r.id]))

// 뱃지 인증 연봉 보유자
const vers = await fetchAll(() => sb.from('salary_verifications')
  .select('user_id, created_at').eq('status', 'approved').order('created_at', { ascending: false }))
const verifiedSalaryIds = new Set(vers.map(v => v.user_id))

const N = pool.length
const pct = n => `${n}명 (${(n / N * 100).toFixed(1)}%)`

// 학교/어학 등급은 lib/talentQuality.js 버킷을 그대로 사용 — 어드민 인재 퀄리티 탭과 동일 규칙.

function levelBucket(m) {
  if (m === null || m === undefined) return 'unknown'
  if (m === 0) return '신입'
  if (m < 24) return '주니어(<2y)'
  if (m < 60) return '미들(2-5y)'
  return '시니어(5y+)'
}


const dist = (fn) => {
  const m = {}
  for (const r of pool) { const k = fn(r); m[k] = (m[k] || 0) + 1 }
  return Object.entries(m).sort((a, b) => b[1] - a[1])
}

console.log(`\n인재풀 모수: ${N}명 (resume_url 보유, 내부계정 제외)\n`)

console.log('── 신호별 보유율 ──')
const links = r => Array.isArray(r.resume_summary?.links) ? r.resume_summary.links : []
const has = {
  '사진(photo_url)': r => !!r.photo_url,
  '학교 기재': r => !!(r.university || r.verified_school_name),
  '영어 어학 기재': r => !!r.english_cert,
  '한국어 기재': r => !!r.korean_cert,
  '경력(experiences) 1건+': r => asExperiences(r.experiences).length > 0,
  '연차(yoe_months) 파악': r => r.yoe_months !== null && r.yoe_months !== undefined,
  '포폴/링크(resume_summary.links)': r => links(r).length > 0,
  '연봉 파악(직접기입∪뱃지인증)': r => r.current_salary != null || verifiedSalaryIds.has(r.id),
  '이력서 공개': r => !!r.is_resume_public,
  'AI 파싱 완료(resume_summary)': r => !!r.resume_summary,
  '유명기업 경력(현지 포함, BRAND_TYPES)': r => brandTypesOf(asExperiences(r.experiences)).size > 0,
}
for (const [label, fn] of Object.entries(has)) console.log(`  ${label}: ${pct(pool.filter(fn).length)}`)

console.log('\n── 학교 등급 분포 (명문top/해외/strong/기타/미기재) ──')
for (const [k, v] of dist(schoolBucketOf)) console.log(`  ${k}: ${pct(v)}`)

console.log('\n── 영어 등급 (high=IELTS7+·TOEIC850+·fluent / mid=IELTS6+·TOEIC700+·B2) ──')
for (const [k, v] of dist(r => enBucketOf(r.english_cert))) console.log(`  ${k}: ${pct(v)}`)

console.log('\n── 한국어 등급 ──')
for (const [k, v] of dist(r => koBucketOf(r.korean_cert))) console.log(`  ${k}: ${pct(v)}`)

console.log('\n── 경력 레벨 ──')
for (const [k, v] of dist(r => levelBucket(r.yoe_months))) console.log(`  ${k}: ${pct(v)}`)

console.log('\n── 졸업연도 ──')
for (const [k, v] of dist(r => {
  const y = +r.graduation_year
  if (!y) return '미상'
  return y >= 2024 ? '2024+' : y >= 2020 ? '2020-23' : y >= 2015 ? '2015-19' : '~2014'
})) console.log(`  ${k}: ${pct(v)}`)

// ── 신호 개수 스택 — "좋은 인재" 후보 신호를 몇 개나 갖췄나 ──
console.log('\n── 핵심 신호 보유 개수 (사진 / 명문·해외대 / 어학상급(영high∪한국어) / 경력2y+ / 포폴링크) ──')
const signalCount = r => {
  let n = 0
  if (r.photo_url) n++
  const s = schoolBucketOf(r); if (s === 'top' || s === 'overseas') n++
  if (enBucketOf(r.english_cert) === 'high' || ['high', 'mid'].includes(koBucketOf(r.korean_cert))) n++
  if ((r.yoe_months || 0) >= 24) n++
  if (links(r).length > 0) n++
  return n
}
for (const [k, v] of dist(signalCount).sort((a, b) => b[0] - a[0])) console.log(`  ${k}개: ${pct(v)}`)

console.log('\n── 경력 회사명 상위 40 (experiences 전체, 정규화 없음 — 대기업 기준 잡을 때 참고) ──')
const coCount = {}
for (const r of pool) for (const e of asExperiences(r.experiences)) {
  const c = (e?.company || '').trim().toLowerCase().replace(/\s+/g, ' ')
  if (!c) continue
  coCount[c] = (coCount[c] || 0) + 1
}
Object.entries(coCount).sort((a, b) => b[1] - a[1]).slice(0, 40)
  .forEach(([c, n]) => console.log(`  ${String(n).padStart(3)}  ${c}`))
