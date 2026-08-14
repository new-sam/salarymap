import { SUBMIT_ROLE_VALUES } from '../constants/jobs.js'; // 확장자 필수 — plain node 스크립트에서도 import된다

// 수집한 현/직전연봉(user_profiles.current_salary)을 연봉 통계 1행(submissions, source='talent')으로 파생한다.
// /api/salary-update 훅과 백필 스크립트(scripts/backfill-salary-submissions.mjs)가 공용.
//
// 직군: 프로필 position은 ROLE_GROUPS(+구파서 잔존값) enum이라 submissions enum과 다르다 —
// 가장 가까운 submissions 직군으로 매핑(유저 결정 8/14: Other 최소화). 미지 값만 Other.
const NEAREST_SUBMIT_ROLE = {
  'Web': 'Frontend',
  'Embedded': 'Backend',
  'Game': 'Fullstack',
  'BI': 'Data Analyst',
  'ML Engineer': 'AI Engineer',
  'SRE': 'DevOps',
  'SysAdmin': 'DevOps',
  'Cloud': 'DevOps',
  'Network': 'DevOps',
  'DBA': 'Data Engineer',
  'QA Automation': 'QA',
  'Design': 'UI/UX Designer',
  'UX Researcher': 'UI/UX Designer',
  'Security Engineer': 'DevOps',
  'Security Analyst': 'DevOps',
  'Penetration Tester': 'DevOps',
  'Solutions Architect': 'Backend',
  'Tech Lead': 'Fullstack',
  'Engineering Manager': 'PM',
  'CTO': 'PM',
  'Technical Writer': 'Content Marketing',
  'ERP/CRM': 'Business Analyst',
  'Blockchain': 'Backend',
  'Merchandiser': 'Procurement',
  'HR': 'HR Generalist',
  'Marketing': 'Digital Marketing',
  'Sales': 'Sales (B2B)',
  'Finance': 'Accountant',
  'Interpreter': 'Interpreter / Translator',
  'IT Support': 'Other',
  'Non-IT': 'Other',
  // 구파서 legacy 값 — 8/14 current_salary 보유 419명 분포 실측에서 발견된 것들
  'AI/Data': 'AI Engineer',
  'Sales Engineer': 'Sales (B2B)',
  'Marketing & Kinh doanh': 'Digital Marketing',
  'Business & Ops': 'Operations',
};

export function toSubmitRole(position) {
  const p = (position || '').trim();
  if (!p) return null;
  if (SUBMIT_ROLE_VALUES.includes(p)) return p;
  return NEAREST_SUBMIT_ROLE[p] || 'Other';
}

// yoe_months → 연봉위저드 경력 버킷(문자열은 submit.js VALID_EXPS와 동일해야 한다 — en dash 주의)
export function toExpBucket(months) {
  if (!Number.isFinite(months)) return null;
  if (months < 12) return 'Under 1yr';
  if (months < 36) return '1–2 yrs';
  if (months < 60) return '3–4 yrs';
  if (months < 96) return '5–7 yrs';
  return '8+ yrs';
}

// 회사 귀속: 현재연봉이면 이력서의 재직중(end=Present) 회사, 직전연봉이면 가장 최근 종료된 회사.
// experiences는 파싱 결과라 MOST RECENT FIRST. 구분 미상(프로필 폼 기입)은 회사 없이 통계만 기여.
function companyFor(experiences, salaryType) {
  const exps = Array.isArray(experiences) ? experiences : [];
  const isPresent = (e) => String(e?.end || '').toLowerCase() === 'present';
  let hit = null;
  if (salaryType === 'current') hit = exps.find((e) => e?.company && isPresent(e));
  else if (salaryType === 'previous') hit = exps.find((e) => e?.company && !isPresent(e));
  const name = (hit?.company || '').trim();
  return name.length >= 2 ? name : null;
}

// null 반환 = 파생 불가(직군·연차 미상 또는 연봉이 위저드 허용범위 3~300 triệu/월 밖).
// company는 canonical 처리 전 원본 — 저장 지점에서 canonicalCompanyName을 거칠 것.
export function deriveSalarySubmission(profile, salaryType) {
  const role = toSubmitRole(profile?.position);
  const experience = toExpBucket(profile?.yoe_months);
  const salary = Math.round((Number(profile?.current_salary) / 1e6) * 10) / 10;
  if (!role || !experience) return null;
  if (!Number.isFinite(salary) || salary < 3 || salary > 300) return null;
  return { role, experience, salary, company: companyFor(profile?.experiences, salaryType) };
}
