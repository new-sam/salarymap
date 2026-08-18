/* 인재풀 퀄리티 신호 분류 — 어드민 '인재 퀄리티' 탭(TalentQualityView)이 쓴다.

   어학/학벌 컷은 TalentPoolView 의 elite* 점수와 같은 정규식 규칙(표기 편차 방어 포함)을
   버킷으로 재현한 것. 유명기업은 "한국 대기업"만이 아니라 현지(베트남)에서 통하는
   네임밸류를 포함한다 — VN 아웃소싱 대형·프로덕트/빅테크·은행이 VN-VN 채용에서는 1급 스펙. */
import { classifyUniversity, overseasOf } from './topUniversities.js' // 확장자 필수 — plain node 스크립트에서도 import된다

// 학벌: 인증 학교(verified_school_tier) ∪ 자유입력 university 분류. TalentPoolView eliteSchoolScore 규칙.
export function schoolBucketOf(r) {
  if (!(r.university || r.verified_school_name)) return 'none'
  if (r.verified_school_tier === 'top') return 'top'
  const c = classifyUniversity(r.university) || classifyUniversity(r.verified_school_name)
  if (c?.tier === 'top') return 'top'
  if (overseasOf(r.university) || overseasOf(r.verified_school_name)) return 'overseas'
  if (c?.tier === 'strong') return 'strong'
  return 'other'
}

// 영어: high = IELTS 7+ · TOEIC 850+ · fluent/C1+, mid = IELTS 6+ · TOEIC 700+ · B2급.
// low(기초)는 낮은 점수/급간이 실제로 확인된 경우만 — 표기는 있는데 급간을 못 읽으면 unknown(판별불가).
export function enBucketOf(s) {
  if (!s) return 'none'
  const ielts = s.match(/ielts[^0-9]*(\d(?:\.\d)?)/i)
  if (ielts) return +ielts[1] >= 7 ? 'high' : +ielts[1] >= 6 ? 'mid' : 'low'
  const toeic = s.match(/toeic[^0-9]*(\d{3})/i)
  if (toeic) return +toeic[1] >= 850 ? 'high' : +toeic[1] >= 700 ? 'mid' : 'low'
  if (/native|fluent|c1|c2|advanced/i.test(s)) return 'high'
  if (/b2|upper|business|professional/i.test(s)) return 'mid'
  if (/a1|a2|b1|elementary|beginner|basic|intermediate/i.test(s)) return 'low'
  return 'unknown'
}

// 한국어: high = TOPIK 5+ · fluent, mid = TOPIK 3-4 · intermediate. 급간 불명은 unknown.
export function koBucketOf(s) {
  if (!s) return 'none'
  const topik = s.match(/topik[^0-9]*(\d)/i)
  if (topik) return +topik[1] >= 5 ? 'high' : +topik[1] >= 3 ? 'mid' : 'low'
  if (/native|fluent|advanced/i.test(s)) return 'high'
  if (/business|intermediate/i.test(s)) return 'mid'
  if (/basic|beginner|elementary|초급/i.test(s)) return 'low'
  return 'unknown'
}

// 경력 레벨 — TalentPoolView LEVELS 와 같은 컷 (0 / <24 / <60 / 60+)
export function levelBucketOf(m) {
  if (m === null || m === undefined) return 'unknown'
  if (m === 0) return 'new'
  if (m < 24) return 'junior'
  if (m < 60) return 'mid'
  return 'senior'
}

/* 경력 회사 네임밸류 유형 — 키워드 러프 매칭(회사명 자유입력이라 표기 편차로 소폭 누락 가능).
   examples 는 UI 캡션용. 새 유명 회사를 발견하면(탭의 '회사명 상위 빈도' 검수 리스트) 여기에 추가. */
export const BRAND_TYPES = [
  {
    key: 'vnOutsourcing',
    label: { ko: 'VN 아웃소싱 대형', en: 'VN IT outsourcing majors', vi: 'Outsourcing lớn VN' },
    examples: 'FPT SW · TMA · CMC · Rikkei',
    re: /fpt (software|is|telecom)|\btma\b|cmc global|rikkei|nashtech|\bkms\b|splus|luvina|savvycom|nal solutions|sotatek|smartosc|hybrid technologies/i,
  },
  {
    key: 'vnBigTech',
    label: { ko: 'VN 프로덕트·빅테크', en: 'VN product / big tech', vi: 'Big tech VN' },
    examples: 'VNG · MoMo · Shopee · Viettel',
    re: /\bvng\b|zalo|momo|\btiki\b|shopee|lazada|grab|gameloft|be group|sendo|baemin|vin(group|fast|homes|id|ai|bigdata)|viettel|vnpt|mobifone/i,
  },
  {
    key: 'vnFinance',
    label: { ko: 'VN 은행·금융', en: 'VN banks & finance', vi: 'Ngân hàng · tài chính VN' },
    examples: 'Techcombank · VPBank · BIDV',
    re: /techcombank|vietcombank|\bbidv\b|vpbank|mbbank|\bacb\b|sacombank|tpbank|\bvib\b|fe credit/i,
  },
  {
    key: 'krGroup',
    label: { ko: '한국계 대기업', en: 'Korean conglomerates', vi: 'Tập đoàn Hàn Quốc' },
    examples: 'Samsung · LG · Lotte · Naver',
    re: /samsung|\blg\b|hyundai|lotte|\bcj\b|posco|hanwha|coupang|naver|kakao|\bsk\b|woori|shinhan|kookmin|\bkb\b|hana bank|amore|orion|emart|gs25/i,
  },
  {
    key: 'globalMnc',
    label: { ko: '글로벌 MNC', en: 'Global MNCs', vi: 'MNC toàn cầu' },
    examples: 'Bosch · Intel · IBM · Accenture',
    re: /bosch|\bintel\b|\bibm\b|\bdxc\b|accenture|deloitte|kpmg|\bey\b|pwc|concentrix|unilever|nestle|pepsi|heineken|\bshell\b|panasonic|\bcanon\b|nvidia|microsoft|google|amazon/i,
  },
]

// 경력 배열 → 걸린 네임밸류 유형 key 집합 (한 사람이 여러 유형 가능)
export function brandTypesOf(experiences) {
  const hit = new Set()
  for (const e of experiences) {
    const c = e?.company || ''
    if (!c) continue
    for (const t of BRAND_TYPES) if (t.re.test(c)) hit.add(t.key)
  }
  return hit
}
