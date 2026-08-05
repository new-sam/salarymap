import { submitRoleCategory } from '../constants/jobs'
import { roleMedian } from '../constants/salaryMedians'

// 결과 화면 "나보다 더 주는 회사" 표시용 기준 회사 — 실제 제출이 부족한 직군에서만 사용.
// 실데이터가 2곳 이상 쌓이면 자동으로 실데이터가 우선한다(API 쪽 분기).
// 직군 대분류별로 업종이 맞는 회사를 쓴다 — 생산직에 IT 회사가 뜨지 않게.
const POOLS = {
  tech: [
    { name: 'Grab Vietnam',    domain: 'grab.com',           mult: 1.28 },
    { name: 'Sky Mavis',       domain: 'skymavis.com',       mult: 1.35 },
    { name: 'VNG Corporation', domain: 'vng.com.vn',         mult: 1.18 },
    { name: 'Shopee Vietnam',  domain: 'shopee.vn',          mult: 1.12 },
    { name: 'Momo',            domain: 'momo.vn',            mult: 1.10 },
    { name: 'KMS Technology',  domain: 'kms-technology.com', mult: 1.06 },
  ],
  consumer: [
    { name: 'Unilever Vietnam',  domain: 'unilever.com.vn',    mult: 1.32 },
    { name: 'Grab Vietnam',      domain: 'grab.com',           mult: 1.26 },
    { name: 'Nestlé Vietnam',    domain: 'nestle.com.vn',      mult: 1.22 },
    { name: 'Shopee Vietnam',    domain: 'shopee.vn',          mult: 1.18 },
    { name: 'Masan Group',       domain: 'masangroup.com',     mult: 1.12 },
    { name: 'Suntory PepsiCo',   domain: 'suntorypepsico.vn',  mult: 1.08 },
  ],
  finance: [
    { name: 'Techcombank',       domain: 'techcombank.com.vn',  mult: 1.30 },
    { name: 'KPMG Vietnam',      domain: 'kpmg.com',            mult: 1.25 },
    { name: 'VPBank',            domain: 'vpbank.com.vn',       mult: 1.20 },
    { name: 'Deloitte Vietnam',  domain: 'deloitte.com',        mult: 1.16 },
    { name: 'Vietcombank',       domain: 'vietcombank.com.vn',  mult: 1.12 },
    { name: 'VIB',               domain: 'vib.com.vn',          mult: 1.07 },
  ],
  factory: [
    { name: 'Samsung Electronics Vietnam', domain: 'samsung.com',    mult: 1.32 },
    { name: 'Bosch Vietnam',               domain: 'bosch.com.vn',   mult: 1.26 },
    { name: 'LG Display Vietnam',          domain: 'lgdisplay.com',  mult: 1.20 },
    { name: 'VinFast',                     domain: 'vinfast.vn',     mult: 1.15 },
    { name: 'Canon Vietnam',               domain: 'canon.com.vn',   mult: 1.10 },
    { name: 'Foxconn Vietnam',             domain: 'foxconn.com',    mult: 1.06 },
  ],
  corp: [
    { name: 'Unilever Vietnam',            domain: 'unilever.com.vn',    mult: 1.30 },
    { name: 'Samsung Electronics Vietnam', domain: 'samsung.com',        mult: 1.24 },
    { name: 'Vingroup',                    domain: 'vingroup.net',       mult: 1.19 },
    { name: 'Techcombank',                 domain: 'techcombank.com.vn', mult: 1.14 },
    { name: 'FPT Corporation',             domain: 'fpt.com.vn',         mult: 1.09 },
    { name: 'Grab Vietnam',                domain: 'grab.com',           mult: 1.05 },
  ],
}

const CAT_POOL = {
  it: 'tech', data: 'tech', pm: 'tech', design: 'tech',
  marketing: 'consumer', sales: 'consumer',
  finance: 'finance',
  manufacturing: 'factory', logistics: 'factory',
  hr: 'corp', office: 'corp', other: 'corp',
}

// 직군 기준 중위값 × 회사 배수 → 회사별 중위값. 유저 회사는 제외하고 상위 limit개.
// 유저 연봉이 전부보다 높아 후보가 비면 최소 2곳은 채운다(빈 섹션 방지).
export function seedTopCompanies(role, experience, userSalary, userCompany, limit = 3) {
  const cat = submitRoleCategory(role)
  const pool = POOLS[CAT_POOL[cat?.key] || 'corp']
  const base = roleMedian(role, experience)
  const all = pool
    .filter(c => c.name.toLowerCase() !== (userCompany || '').toLowerCase())
    .map(c => ({ name: c.name, domain: c.domain, median: Math.round(base * c.mult) }))
    .sort((a, b) => b.median - a.median)

  const top = all
    .map(c => ({ ...c, premiumPct: Math.round((c.median - userSalary) / userSalary * 100) }))
    .filter(c => c.premiumPct > 0)
    .slice(0, limit)
  if (top.length >= 2) return top

  const extras = all
    .filter(c => !top.find(t => t.name === c.name))
    .slice(0, 2 - top.length)
    .map(c => ({ ...c, premiumPct: Math.max(1, Math.round((c.median - userSalary) / userSalary * 100)) }))
  return [...top, ...extras].slice(0, limit)
}
