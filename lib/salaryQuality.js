// 연봉 제출 데이터 품질 필터.
// 슬라이더 기본값(62)을 그대로 통과시킨 "참고용 미입력" 제출을 공개 통계에서 제외한다.
// 62는 실제로 그 연봉을 받는 경우도 있으므로, 기본값일 가능성이 압도적인
// 저경력(1년 미만 / 1–2년) 구간에서만 의심값으로 본다.

const DEFAULT_SLIDER_VALUE = 62;
const LOW_EXP = new Set(['Under 1yr', 'Under 1 year', '1–2 yrs', '1-2 yrs']);

export function isSuspiciousSubmission(row) {
  if (!row) return false;
  return Number(row.salary) === DEFAULT_SLIDER_VALUE && LOW_EXP.has(row.experience);
}

// 행 배열에서 의심값 제거. experience 컬럼이 없으면(이미 role+exp로 필터된 쿼리)
// expHint로 보강 판단한다.
export function excludeSuspicious(rows, expHint) {
  if (!Array.isArray(rows)) return rows;
  const lowExp = expHint != null ? LOW_EXP.has(expHint) : null;
  return rows.filter((r) => {
    const exp = r.experience != null ? r.experience : expHint;
    if (Number(r.salary) === DEFAULT_SLIDER_VALUE && (lowExp === true || LOW_EXP.has(exp))) return false;
    return true;
  });
}
