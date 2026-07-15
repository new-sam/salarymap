// 프로필 완성도 — 단일 계산식 (모바일 앱과 동일 기준).
// 소개·경력·학력·스킬·희망연봉·이력서 6개. 사진·이름·지역은 완성도에서 제외.
// GlobalNav 헤더 %와 프로필 페이지 %가 갈라지지 않도록 반드시 이 함수만 사용할 것.
export function completionScore(p) {
  if (!p) return 0
  const checks = [
    !!p.intro,
    (p.experiences?.filter(e => e && (e.company || e.role)).length || 0) > 0,
    !!p.university,
    Array.isArray(p.skills) ? p.skills.length > 0 : !!p.skills,
    !!p.salary_min || !!p.salary_max,
    !!p.resume_url,
  ]
  return Math.round(checks.filter(Boolean).length / checks.length * 100)
}
