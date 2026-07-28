// 급여 집계 공통 정제 — 카드(/api/companies)와 상세(/api/company-detail)가 서로 다른
// 필터(5–200 vs 3–300+IQR)로 집계해 수치가 어긋나던 것을 단일 파이프라인으로 통일.
// SQL RPC(get_company_salary_stats)와 동일 semantics — 한쪽을 바꾸면 같이 바꿀 것.
export const SALARY_MIN = 3
export const SALARY_MAX = 300

// percentile_cont와 동일한 선형보간 백분위 (sorted: 오름차순 정렬 배열)
export function percentile(sorted, p) {
  if (!sorted.length) return 0
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

// IQR 아웃라이어 경계 (표본 4건 미만이면 제거 안 함)
export function cleanBounds(values) {
  const sorted = values.filter(v => v >= SALARY_MIN && v <= SALARY_MAX).sort((a, b) => a - b)
  if (sorted.length < 4) return { lower: -Infinity, upper: Infinity }
  const q1 = percentile(sorted, 0.25)
  const q3 = percentile(sorted, 0.75)
  const iqr = q3 - q1
  return { lower: q1 - 1.5 * iqr, upper: q3 + 1.5 * iqr }
}

// 하드범위(3–300) + IQR 정제를 통과한 값만 오름차순으로 반환
export function cleanSalaries(values) {
  const { lower, upper } = cleanBounds(values)
  return values
    .filter(v => v >= SALARY_MIN && v <= SALARY_MAX && v >= lower && v <= upper)
    .sort((a, b) => a - b)
}
