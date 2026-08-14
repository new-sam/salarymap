// 어드민 연봉 표기용 VND→KRW 대략 기준 환율 — 수동 갱신 (2026-08: USD/KRW≈1,450 · USD/VND≈26,300)
// 1백만 VND ≈ 5.5만 원. 이 상수 하나만 고치면 인재풀·연봉 수집 탭 표기가 함께 바뀐다.
export const KRW_PER_M_VND = 55000

// 백만 VND 금액 → "2,970만원" / "1.2억원" 근사 문자열
export function vndMToKrwText(vndM) {
  if (vndM == null || !isFinite(vndM)) return ''
  const man = Math.round((vndM * KRW_PER_M_VND) / 10000)
  if (man >= 10000) {
    const eok = Math.round((man / 1000)) / 10
    return `${Number.isInteger(eok) ? eok : eok.toFixed(1)}억원`
  }
  return `${man.toLocaleString()}만원`
}
