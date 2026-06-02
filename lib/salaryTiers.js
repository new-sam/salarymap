// Salary verification badge tiers.
// `min` is the inclusive lower bound in KRW (won). Verified salary amounts are
// stored in won (만원 input * 10000). The matched tier is the highest tier whose
// `min` is <= the verified amount. Boundaries live here so they can change without
// a DB migration — the badge row only stores the raw salary_amount.
//
// `defaultLabel` is the Korean label used in non-i18n contexts (admin dashboard).
// In i18n contexts use t(`salary.tier.${tier.key}`).

export const SALARY_TIERS = [
  { key: 'under30', min: 0,         defaultLabel: '3천만원 미만', color: '#94a3b8', grad: 'linear-gradient(135deg,#cbd5e1,#94a3b8)' },
  { key: 't30',     min: 30000000,  defaultLabel: '3천만원대',   color: '#64748b', grad: 'linear-gradient(135deg,#94a3b8,#64748b)' },
  { key: 't40',     min: 40000000,  defaultLabel: '4천만원대',   color: '#0d9488', grad: 'linear-gradient(135deg,#2dd4bf,#0d9488)' },
  { key: 't50',     min: 50000000,  defaultLabel: '5천만원대',   color: '#2563eb', grad: 'linear-gradient(135deg,#60a5fa,#2563eb)' },
  { key: 't60',     min: 60000000,  defaultLabel: '6천만원대',   color: '#7c3aed', grad: 'linear-gradient(135deg,#a78bfa,#7c3aed)' },
  { key: 't70',     min: 70000000,  defaultLabel: '7천만원대',   color: '#c026d3', grad: 'linear-gradient(135deg,#e879f9,#c026d3)' },
  { key: 't80',     min: 80000000,  defaultLabel: '8천만원대',   color: '#ff6000', grad: 'linear-gradient(135deg,#ff8c00,#ff6000)' },
  { key: 't90',     min: 90000000,  defaultLabel: '9천만원대',   color: '#ea580c', grad: 'linear-gradient(135deg,#fb923c,#ea580c)' },
  { key: 't100',    min: 100000000, defaultLabel: '1억원 이상',  color: '#b45309', grad: 'linear-gradient(135deg,#fbbf24,#d97706)' },
]

// Returns the tier object for a verified salary amount in won, or null.
export function getSalaryTier(amountWon) {
  if (amountWon == null || isNaN(amountWon)) return null
  let match = null
  for (const tier of SALARY_TIERS) {
    if (amountWon >= tier.min) match = tier
  }
  return match
}

export function getSalaryTierByKey(key) {
  return SALARY_TIERS.find(t => t.key === key) || null
}
