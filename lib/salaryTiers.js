// Salary verification badge tiers — Vietnam market.
// Salaries across the app are GROSS MONTHLY in VND (input in triệu / million VND,
// stored as raw VND = input * 1,000,000), matching the salary wizard, expected
// salary and jobs pages. `min` is the inclusive lower bound in VND. The matched
// tier is the highest tier whose `min` is <= the verified monthly amount.
// Boundaries live here so they can change without a DB migration — the badge row
// only stores the raw monthly salary_amount (VND).
//
// Five flex tiers for the community show-off badge. The lower two are framed in
// USD/month ("lương nghìn đô"), the upper three in VND tỷ/year ("thu nhập tiền
// tỷ" ≈ Korea's 억대연봉) — the crossover at 85tr/month is where annual income
// passes 1 tỷ. `min` is the inclusive monthly lower bound in VND:
//   nghindo  ≥ 25tr/mo  ≈ $1,000/mo   ≈ 연 3억동
//   nghindo2 ≥ 50tr/mo  ≈ $2,000/mo   ≈ 연 6억동
//   tienty   ≥ 85tr/mo  ≈ 1 tỷ/year   ≈ 연 10억동
//   tienty2  ≥ 167tr/mo ≈ 2 tỷ/year   ≈ 연 20억동
//   tienty3  ≥ 250tr/mo ≈ 3 tỷ/year   ≈ 연 30억동
//
// `defaultLabel` is the Korean-admin label used in non-i18n contexts (admin
// dashboard) and keeps the monthly threshold for verification. In i18n contexts
// (community pill, profile ladder) use t(`salary.tier.${tier.key}`).

export const SALARY_TIERS = [
  { key: 'nghindo',  min: 25000000,  defaultLabel: '천달러 (월 25M+)',      color: '#2563eb', grad: 'linear-gradient(135deg,#60a5fa,#2563eb)' },
  { key: 'nghindo2', min: 50000000,  defaultLabel: '2천달러 (월 50M+)',     color: '#7c3aed', grad: 'linear-gradient(135deg,#a78bfa,#7c3aed)' },
  { key: 'tienty',   min: 85000000,  defaultLabel: '억대·연10억동 (월 85M+)', color: '#b45309', grad: 'linear-gradient(135deg,#fbbf24,#d97706)' },
  { key: 'tienty2',  min: 167000000, defaultLabel: '연 20억동 (월 167M+)',   color: '#be123c', grad: 'linear-gradient(135deg,#fb7185,#be123c)' },
  { key: 'tienty3',  min: 250000000, defaultLabel: '정점·연30억동 (월 250M+)', color: '#0e7490', grad: 'linear-gradient(135deg,#67e8f9,#3b82f6,#8b5cf6)' },
]

// Returns the tier object for a verified monthly salary amount in VND, or null
// (null when below the lowest tier — no badge).
export function getSalaryTier(amountVnd) {
  if (amountVnd == null || isNaN(amountVnd)) return null
  let match = null
  for (const tier of SALARY_TIERS) {
    if (amountVnd >= tier.min) match = tier
  }
  return match
}

export function getSalaryTierByKey(key) {
  return SALARY_TIERS.find(t => t.key === key) || null
}

// 등급 서열(낮을수록 하위). SALARY_TIERS의 인덱스. 없는 키면 -1.
export function tierRank(key) {
  return SALARY_TIERS.findIndex(t => t.key === key)
}

// 커뮤니티에 표시할 연봉 등급 키를 결정한다. 사용자가 고른 대표 등급
// (representativeTier)이 본인 실제 획득 등급 이하인 유효한 등급이면 그것을, 아니면
// 실제 최고 등급을 쓴다(미선택/무효 시 기존 동작). 획득하지 않은 상위 등급은 무시한다.
export function resolveDisplayTier(amountVnd, representativeTier) {
  const actual = getSalaryTier(amountVnd)
  if (!actual) return null
  if (representativeTier) {
    const repRank = tierRank(representativeTier)
    if (repRank >= 0 && repRank <= tierRank(actual.key)) return representativeTier
  }
  return actual.key
}

// Plausibility ceiling for a monthly salary entered in triệu (백만 VND). A real
// monthly salary never reaches 100,000 triệu (= 100 tỷ VND/month), so a value at
// or above this is almost certainly a raw-VND amount typed by mistake
// (e.g. 50000000 instead of 50).
export const MAX_PLAUSIBLE_TRIEU = 100000

// Returns true when a value entered as triệu is implausibly large and therefore
// almost certainly a raw-VND amount (e.g. 50000000).
export function isRawVndMistake(val) {
  const n = Number(val)
  return !!n && !isNaN(n) && n >= MAX_PLAUSIBLE_TRIEU
}

// Coerces a value meant to be triệu (백만 VND) back into triệu, dividing by
// 1,000,000 when it looks like a raw-VND amount. Plausible values pass through.
export function normalizeTrieu(val) {
  const n = Number(val)
  if (!n || isNaN(n)) return val
  return isRawVndMistake(n) ? Math.round(n / 1000000) : n
}
