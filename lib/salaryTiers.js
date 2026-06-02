// Salary verification badge tiers — Vietnam market.
// Salaries across the app are GROSS MONTHLY in VND (input in triệu / million VND,
// stored as raw VND = input * 1,000,000), matching the salary wizard, expected
// salary and jobs pages. `min` is the inclusive lower bound in VND. The matched
// tier is the highest tier whose `min` is <= the verified monthly amount.
// Boundaries live here so they can change without a DB migration — the badge row
// only stores the raw monthly salary_amount (VND).
//
// Two tiers, named after the two everyday Vietnamese high-earner phrases:
//   nghin-do  "lương nghìn đô"  — earns ~1,000 USD+/month  (≈ 25tr VND/month)
//   tien-ty   "thu nhập tiền tỷ" — earns 1 tỷ+ VND/year     (≈ 85tr VND/month;
//             closest equivalent to Korea's 억대연봉)
//
// `defaultLabel` is the Korean-admin label used in non-i18n contexts (admin
// dashboard). In i18n contexts use t(`salary.tier.${tier.key}`).

export const SALARY_TIERS = [
  { key: 'nghindo', min: 25000000, defaultLabel: '천달러급 (월 25M VND+)',      color: '#2563eb', grad: 'linear-gradient(135deg,#60a5fa,#2563eb)' },
  { key: 'tienty',  min: 85000000, defaultLabel: '억대·연10억동 (월 85M VND+)', color: '#b45309', grad: 'linear-gradient(135deg,#fbbf24,#d97706)' },
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
