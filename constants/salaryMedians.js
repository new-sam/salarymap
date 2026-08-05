// 시드 스크립트(node)가 직접 import하므로 확장자 명시
import { submitRoleCategory } from './jobs.js'

// 직군 × 연차 중위값 (triệu VND/월) — 시드 데이터 생성(scripts/seed-nondev-salaries.mjs)과
// 결과 화면 회사 비교(lib/seedCompanies.js)의 공통 소스. 두 곳이 어긋나면 안 되므로 여기서만 관리.
export const EXP_BANDS = ['Under 1yr', '1–2 yrs', '3–4 yrs', '5–7 yrs', '8+ yrs']

// 비개발 소분류 — CareerViet VietnamSalary 크라우드 + Adecco/Manpower/NIC 2026 연봉가이드 기준(유저 확정표)
export const NONDEV_MEDIANS = {
  'Sales (B2B)':             [8, 11, 14, 19, 26],
  'Sales (B2C / Retail)':    [7, 9, 12, 15, 20],
  'Telesales':               [7, 9, 11, 14, 18],
  'Customer Service':        [8, 10, 12, 15, 20],
  'Business Development':    [10, 13, 17, 24, 33],
  'Digital Marketing':       [9, 12, 16, 22, 30],
  'Content Marketing':       [8, 11, 14, 18, 25],
  'Performance / Ads':       [9, 13, 17, 23, 32],
  'Brand Marketing':         [9, 12, 16, 23, 33],
  'Recruiter':               [8, 11, 14, 18, 25],
  'HR Generalist':           [8, 10, 13, 17, 24],
  'C&B':                     [9, 12, 16, 21, 28],
  'Admin / GA':              [7, 9, 11, 14, 19],
  'Accountant':              [8, 11, 14, 16, 20],
  'Financial Analyst':       [11, 14, 17, 23, 32],
  'Audit / Tax':             [10, 13, 17, 23, 32],
  'Banking':                 [11, 13, 16, 22, 32],
  'Production Worker':       [7, 8, 9, 10, 12],
  'Production Manager':      [10, 13, 17, 24, 32],
  'Process Engineer':        [10, 13, 17, 24, 34],
  'Maintenance':             [8, 10, 13, 17, 22],
  'QC':                      [8, 10, 13, 17, 23],
  'HSE':                     [9, 11, 14, 19, 25],
  'Warehouse':               [7, 9, 11, 13, 17],
  'Procurement':             [9, 11, 14, 18, 25],
  'Import / Export':         [8, 11, 14, 18, 25],
  'Supply Chain':            [10, 13, 17, 24, 34],
  'Secretary / Assistant':   [8, 10, 12, 15, 20],
  'Operations':              [9, 11, 14, 19, 26],
  'Legal':                   [10, 13, 17, 24, 33],
  'Interpreter / Translator':[12, 15, 20, 28, 36],
}

// IT 계열 — 기존 percentile.js BASE_MEDIANS 그대로(legacy role 값 키)
export const IT_MEDIANS = {
  'Backend':   [25, 40, 75, 110, 140],
  'Frontend':  [22, 36, 68, 100, 130],
  'Mobile':    [24, 38, 72, 105, 135],
  'Data · AI': [28, 45, 80, 115, 145],
  'DevOps':    [26, 42, 78, 112, 138],
  'PM · PO':   [22, 35, 65,  95, 125],
  'Design':    [20, 32, 60,  88, 115],
  'QA':        [18, 28, 50,  72,  95],
}

// 소분류에 자체 표가 없을 때 쓰는 대분류 대표값
const CAT_FALLBACK = {
  it: 'Backend', data: 'Data · AI', pm: 'PM · PO', design: 'Design', other: 'Operations',
}

// role 값 → 해당 연차 중위값. 소분류 표 → IT 표 → 대분류 대표값 순.
export function roleMedian(role, experience) {
  const cat = submitRoleCategory(role)
  const fb = cat && CAT_FALLBACK[cat.key]
  const arr = NONDEV_MEDIANS[role] || IT_MEDIANS[role]
    || (fb && (IT_MEDIANS[fb] || NONDEV_MEDIANS[fb])) || NONDEV_MEDIANS['Operations']
  const i = EXP_BANDS.indexOf(experience)
  return arr[i >= 0 ? i : 2]
}
