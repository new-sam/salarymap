// 비개발 신규 소분류 시드 연봉 데이터 생성 — 2026-08 랜딩 전직군 개편 후속.
// 근거: CareerViet VietnamSalary 크라우드 실측 + Adecco/Manpower/NIC 2026 연봉가이드
// (중위값 표는 유저 확정, 자세한 출처는 memory/landing-all-roles.md 참조).
//
// 설계:
//  - company = null  → 가짜 회사 비교(topCompanies/companiesPayingMore)에 안 섞임, 분포만 채움
//  - experience = 표준 밴드 문자열 → 퍼센타일 코호트에 정상 편입
//  - source = 'seed' → 랜딩 카운터·티커·어드민 실유입 지표에서 기존 시드와 동일하게 제외
//  - 건수는 1-2/3-4년차에 가중, 8+는 소수 — 실제 제출 분포 모사
//  - 연봉은 중위값 기준 로그정규 근사(우측 꼬리), created_at 최근 60일 분산
//
// 사용: node scripts/seed-nondev-salaries.mjs         (드라이런: 요약만 출력)
//       node scripts/seed-nondev-salaries.mjs --apply (prod 삽입)
import { sb } from './outreach/lib.mjs'
import { NONDEV_MEDIANS as MEDIANS, EXP_BANDS } from '../constants/salaryMedians.js'

// 밴드별 건수: [기본, 랜덤폭] — 주니어~미드에 몰리는 실제 분포 모사.
// 실행 이력(누적): 1차 8/5 [[5,3],[8,4],[8,4],[5,3],[2,3]] = 1,149건 삽입됨.
// 아래는 2차 증량분(8/5) — 밴드당 최종 ~18/28/28/18/8건 목표. ⚠️재실행 시 또 누적됨.
const BAND_COUNT = [[12, 6], [18, 8], [18, 8], [12, 6], [5, 4]]

const ri = (n) => Math.floor(Math.random() * n)
// 중위값 기준 로그정규 근사 샘플 — 대략 ±20%, 가끔 ±40%, 우측 꼬리
function sampleSalary(median) {
  const u = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5 // ~N(0, 0.33)
  const factor = Math.min(1.5, Math.max(0.7, Math.exp(u * 0.55)))
  return Math.max(6, Math.round(median * factor))
}
function sampleCreatedAt() {
  const d = new Date(Date.now() - ri(60 * 24) * 3600 * 1000) // 최근 60일
  d.setHours(8 + ri(15), ri(60), ri(60), 0) // 08~22시(ICT 낮·저녁대)
  return d.toISOString()
}

const rows = []
for (const [role, medians] of Object.entries(MEDIANS)) {
  medians.forEach((median, bi) => {
    const n = BAND_COUNT[bi][0] + ri(BAND_COUNT[bi][1] + 1)
    for (let i = 0; i < n; i++) {
      rows.push({
        role,
        experience: EXP_BANDS[bi],
        salary: sampleSalary(median),
        company: null,
        source: 'seed',
        created_at: sampleCreatedAt(),
      })
    }
  })
}

// 요약 출력
const byRole = {}
rows.forEach(r => {
  byRole[r.role] = byRole[r.role] || { n: 0, sals: [] }
  byRole[r.role].n++
  byRole[r.role].sals.push(r.salary)
})
console.log('role\tn\tmin\tmed\tmax')
for (const [role, { n, sals }] of Object.entries(byRole)) {
  const s = sals.sort((a, b) => a - b)
  console.log(`${role}\t${n}\t${s[0]}\t${s[Math.floor(s.length / 2)]}\t${s[s.length - 1]}`)
}
console.log(`\ntotal rows: ${rows.length}`)

if (!process.argv.includes('--apply')) {
  console.log('\n(dry-run — 삽입하려면 --apply)')
  process.exit(0)
}

for (let i = 0; i < rows.length; i += 500) {
  const chunk = rows.slice(i, i + 500)
  const { error } = await sb.from('submissions').insert(chunk)
  if (error) { console.error('insert failed at', i, error.message); process.exit(1) }
  console.log(`inserted ${Math.min(i + 500, rows.length)}/${rows.length}`)
}
console.log('done')
