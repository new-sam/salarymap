// 베트남 명문대 표준화 + tier 판정.
//
// 목적: 공개 인재풀의 "Top-tier 대학 비율"을 정확히 재기 위함. user_profiles.university는
// 자유입력이라 표기가 분산돼 있다(UIT가 "UIT" / "University of Information Technology" /
// "UNIVERSITY OF INFORMATION TECHNOLOGY" 3종 등). 입력 문자열을 정규화해 canonical 학교로
// 매핑하고 tier를 돌려준다.
//
// tier 정의(고용시장 prestige 기준 — 연구 h-index가 아니라 "명문" 체감 기준):
//   'top'    : KPI에서 top-tier로 집계. 국가대표 플래그십 + 엘리트 공대/상경계.
//   'strong' : 지역 거점/준명문. KPI엔 미포함(정책상 조정 가능).
//   null     : 매칭 안 됨(미상/기타).
//
// ⚠️ tier 배정은 정책 선택이다. 예: 연구지표 랭킹 상위인 Ton Duc Thang/Duy Tan은 고용
// prestige 기준에선 'strong'으로 뒀다. 회사 기준이 다르면 아래 RULES의 tier만 바꾸면 된다.

// 베트남어 발음부호 제거 + 소문자 + 구두점 정리.
export function normalize(raw) {
  if (!raw) return ''
  return String(raw)
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // 결합 발음부호 제거
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// 우선순위 순서대로 평가. 첫 매칭을 채택하므로 "배제해야 할 사칭"을 먼저 둔다.
// (예: HUTECH는 Bách Khoa(HCMUT)와 이름이 겹치지만 별개의 사립대라 top이 아니다.)
const has = (s, ...words) => words.every(w => s.includes(w))
const RULES = [
  // --- 사칭/혼동 방지: 이름이 명문과 겹치지만 tier가 다른 학교를 먼저 가로챈다 ---
  { canonical: 'HUTECH (HCMC Univ. of Technology, private)', tier: 'strong',
    test: s => s.includes('hutech') },
  { canonical: 'Hoa Sen University', tier: 'strong',
    test: s => has(s, 'hoa', 'sen') },

  // --- Tier: top (KPI 집계 대상) ---
  // VNU 계열 — 멤버교를 개별 매칭(USSH 등 비대상 멤버는 매칭 안 함)
  { canonical: 'HCMUT (Bách Khoa, VNU-HCM)', tier: 'top',
    test: s => s.includes('bach khoa') || (has(s, 'university', 'technology') && (s.includes('ho chi minh') || s.includes('hcm'))) },
  { canonical: 'University of Science (VNU-HCM)', tier: 'top',
    test: s => has(s, 'university', 'scien') && (s.includes('ho chi minh') || s.includes('hcm')) },
  { canonical: 'UIT (VNU-HCM)', tier: 'top',
    test: s => /\buit\b/.test(s) || has(s, 'information', 'technology') },
  { canonical: 'International University (VNU-HCM)', tier: 'top',
    test: s => has(s, 'international', 'university') && (s.includes('ho chi minh') || s.includes('hcm') || s.includes('vnu')) },
  { canonical: 'VNU-HCM', tier: 'top',
    test: s => (has(s, 'vietnam', 'national', 'university') || s.includes('vnu')) && (s.includes('ho chi minh') || s.includes('hcm')) },
  { canonical: 'UET (VNU Hanoi)', tier: 'top',
    test: s => has(s, 'engineering', 'technology') && (s.includes('vnu') || s.includes('national university')) && s.includes('ha noi') },
  // VNU 약칭: ĐHQGHN(Hà Nội) / ĐHQG-HCM. dhqghn 토큰이 붙으면 VNU 멤버교.
  { canonical: 'VNU Hanoi', tier: 'top',
    test: s => s.includes('dhqghn') || (s.includes('dhqg') && (s.includes('ha noi') || s.includes('hn'))) },
  // University of Science (VNU) — Hà Nội/HCM 어느 캠퍼스든 VNU 과학대는 top.
  { canonical: 'University of Science (VNU)', tier: 'top',
    test: s => s.includes('vnu') && s.includes('scien') },
  { canonical: 'VNU Hanoi', tier: 'top',
    test: s => (has(s, 'vietnam', 'national', 'university') || s.includes('vnu')) && (s.includes('ha noi') || s.includes('hanoi')) },

  // 엘리트 단과/전문대
  { canonical: 'HUST (Bách Khoa Hà Nội)', tier: 'top',
    test: s => s.includes('hust') || (has(s, 'hanoi', 'science', 'technology')) || (has(s, 'ha noi', 'science', 'technology')) },
  { canonical: 'Danang Univ. of Science and Technology (Bách Khoa)', tier: 'top',
    test: s => (s.includes('da nang') || s.includes('danang')) && has(s, 'science', 'technology') },
  { canonical: 'PTIT', tier: 'top',
    test: s => s.includes('ptit') || has(s, 'posts', 'telecommunications') || has(s, 'buu chinh', 'vien thong') },
  { canonical: 'FPT University', tier: 'top',
    test: s => has(s, 'fpt') && s.includes('univ') || /\bfpt\b/.test(s) },
  { canonical: 'RMIT Vietnam', tier: 'top',
    test: s => s.includes('rmit') },
  { canonical: 'Foreign Trade University (FTU)', tier: 'top',
    test: s => /\bftu\b/.test(s) || has(s, 'foreign', 'trade') },
  { canonical: 'National Economics University (NEU)', tier: 'top',
    test: s => /\bneu\b/.test(s) || has(s, 'national', 'economics') },
  { canonical: 'University of Economics HCMC (UEH)', tier: 'top',
    test: s => s.includes('ueh') || (has(s, 'university', 'economics') && (s.includes('ho chi minh') || s.includes('hcm'))) },
  { canonical: 'Le Quy Don Technical University', tier: 'top',
    test: s => has(s, 'le quy don') },

  // --- Tier: strong (지역 거점/준명문 — 현재 KPI 미집계) ---
  { canonical: 'Can Tho University', tier: 'strong',
    test: s => has(s, 'can tho') },
  { canonical: 'Ton Duc Thang University', tier: 'strong',
    test: s => has(s, 'ton duc thang') },
  { canonical: 'Duy Tan University', tier: 'strong',
    test: s => has(s, 'duy tan') },
  { canonical: 'Industrial University of HCMC', tier: 'strong',
    test: s => has(s, 'industrial') && (s.includes('ho chi minh') || s.includes('hcm')) },
  { canonical: 'University of Transport and Communications', tier: 'strong',
    test: s => has(s, 'transport') },
]

// raw 입력 → { canonical, tier } | null
export function classifyUniversity(raw) {
  const s = normalize(raw)
  if (!s) return null
  for (const r of RULES) {
    if (r.test(s)) return { canonical: r.canonical, tier: r.tier }
  }
  return null
}

// KPI용: top-tier 여부
export function isTopTier(raw) {
  const r = classifyUniversity(raw)
  return !!r && r.tier === 'top'
}
