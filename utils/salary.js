import { MARKET_SALARY, TECH_PREMIUM } from '../constants/jobs'

function companyHash(name) {
  if (!name) return 0
  let h = 0
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0
  return ((h % 100) / 100) * 0.10 - 0.05
}

function titleSeniority(title) {
  if (!title) return 1.0
  const t = title.toLowerCase()
  if (/\b(principal|staff|architect)\b/.test(t)) return 1.15
  if (/\b(lead|head)\b/.test(t)) return 1.10
  if (/\bsenior\b/.test(t)) return 1.06
  if (/\b(junior|intern|fresher)\b/.test(t)) return 0.90
  return 1.0
}

function cityFactor(location) {
  if (!location) return 1.0
  const loc = location.toLowerCase()
  if (/da nang|đà nẵng|danang/.test(loc)) return 0.90
  if (/ha noi|hà nội|hanoi/.test(loc)) return 0.95
  return 1.0
}

export function getEstimatedSalary(job) {
  const table = MARKET_SALARY[job.role] || MARKET_SALARY.Backend
  const bands = [0, 1, 3, 5, 8]
  const midExp = job.experience_min != null && job.experience_max != null ? (job.experience_min + job.experience_max) / 2 : 3
  let band = bands[0]
  for (const b of bands) { if (midExp >= b) band = b }
  const median = table[band]
  const countryMult = job.country === 'global' ? 1.20 : job.country === 'korea' ? 1.15 : 1.0
  const sizeNum = parseInt(job.company_size) || 0
  const sizeMult = sizeNum >= 200 ? 1.10 : sizeNum >= 50 ? 1.0 : sizeNum > 0 ? 0.95 : 1.0
  const cityMult = job.type === 'remote' ? 1.03 : cityFactor(job.location)
  const titleMult = titleSeniority(job.title)
  let techMult = 1.0
  if (job.tech_stack?.length) {
    const premiums = job.tech_stack.map(t => TECH_PREMIUM[t]).filter(Boolean)
    if (premiums.length) techMult = Math.min(1.12, premiums.reduce((a, b) => a + b, 0) / premiums.length)
  }
  const compOffset = 1.0 + companyHash(job.company)
  const multiplier = countryMult * sizeMult * cityMult * titleMult * techMult * compOffset
  const min = Math.round(median * 0.87 * multiplier)
  const max = Math.round(median * 1.13 * multiplier)
  return { min, max, estimated: true }
}

export function formatSalaryCard(job) {
  if (job.salary_min > 0 && job.salary_max > 0) {
    return { min: job.salary_min, max: job.salary_max, estimated: false }
  }
  return getEstimatedSalary(job)
}

export function getHighSalaryThreshold(jobs) {
  if (!jobs.length) return Infinity
  const mins = jobs.map(j => formatSalaryCard(j).min).sort((a, b) => b - a)
  return mins[Math.floor(mins.length * 0.30)] || mins[mins.length - 1]
}
