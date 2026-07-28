// 연봉 제출 데이터 품질 필터.
// 슬라이더 기본값(62)을 그대로 통과시킨 "참고용 미입력" 제출을 공개 통계에서 제외한다.
//
// 2026-06-20 커밋 4fbb220이 salaryTouched 가드를 넣어 입력 쪽은 막혔다. 실측 비율:
//   가드 이전 9,471건 중 62M 666건 (7.03%)
//   가드 이후 1,602건 중 62M   7건 (0.44%)  ← 이웃값(61M·63M) 수준 = 진짜 62M
// 즉 오염은 가드 이전 데이터에만 있다. 날짜로 끊으면 493건을 더 걸러내면서
// 가드 이후의 진짜 62M 제출은 살릴 수 있다.
// (기존 규칙은 "저경력 62M"만 봐서 666건 중 137건밖에 못 잡았다.)

export const DEFAULT_SLIDER_VALUE = 62;
export const SLIDER_GUARD_DEPLOYED_AT = '2026-06-20';
const LOW_EXP = new Set(['Under 1yr', 'Under 1 year', '1–2 yrs', '1-2 yrs']);

// created_at이 없는 행(이미 집계된 쿼리 결과 등)은 경력 기준으로만 판단한다.
function isDefaultSliderValue(salary, experience, createdAt) {
  if (Number(salary) !== DEFAULT_SLIDER_VALUE) return false;
  if (createdAt) return String(createdAt) < SLIDER_GUARD_DEPLOYED_AT;
  return LOW_EXP.has(experience);
}

export function isSuspiciousSubmission(row) {
  if (!row) return false;
  return isDefaultSliderValue(row.salary, row.experience, row.created_at);
}

// 행 배열에서 의심값 제거. experience 컬럼이 없으면(이미 role+exp로 필터된 쿼리)
// expHint로 보강 판단한다.
export function excludeSuspicious(rows, expHint) {
  if (!Array.isArray(rows)) return rows;
  return rows.filter((r) => {
    const exp = r.experience != null ? r.experience : expHint;
    return !isDefaultSliderValue(r.salary, exp, r.created_at);
  });
}
