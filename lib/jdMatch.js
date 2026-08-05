import { asSkills, asExperiences } from './talentCategory'

/* JD ↔ 이력서 매칭.

   판정 규칙은 ktc-support(스크리닝 운영 도구)에서 이미 굴려 본 것을 옮겨왔다.
   출처를 밝혀 두는 이유는 아래 숫자들이 임의값이 아니라 실제 전달 이력에서 뽑은
   값이라, 여기서 감으로 올리고 내리면 안 되기 때문이다.

   옮겨온 것 셋:

   1) 등급·점수는 LLM 이 아니라 코드가 낸다. LLM 은 요건별 충족/미달만 판정한다.
      저쪽에서 LLM 이 스스로 낸 등급은 자기가 센 미달 개수와 35% 확률로 어긋났고
      어긋나는 방향이 전부 관대한 쪽이었다 — 근거를 설명할 수 없고 재실행하면 흔들린다.

   2) 통과선은 미달 '개수'가 아니라 '충족률'이다. 개수로 자르면 요건을 자세히 쓴 JD 가
      불리해진다 — 요건 20개짜리 JD 는 95% 충족을 요구하고 3개짜리는 67% 만 요구하는 꼴이
      된다. 비율은 JD 길이에 중립적이다.

   3) 연차는 하드 게이트가 아니라 요건 하나다. 허용창은 요구 ±1년이되 하한을 요구 하한의
      절반 밑으로는 안 내린다 — 그냥 −1 하면 "1~3년" 요구에 신입(0.25년)이 통과한다.

   우리 쪽에서 달라진 것: 저쪽은 지원자 한 명을 JD 에 대고 보지만(이력서 PDF 를 통째로
   모델에 넣는다), 여기는 1,400여 명 중에서 5명을 고른다. 전원을 PDF 로 볼 수는 없으니
   코드가 먼저 점수로 20명까지 좁히고 그 20명만 LLM 이 요건별로 본다. 그것도 PDF 가 아니라
   파서가 뽑아 둔 프로필(주요이력·스킬·학력·경력)로 본다 — 여기까지가 1차 거름망이고,
   최종 판단은 사람이 이력서를 열어 본다는 전제다. */

/* 통과선 0.5 는 저쪽에서 실제로 고객사까지 전달된 지원자 1,567명의 충족률 5%분위다.
   즉 운영팀이 지금까지 통과시켜 온 하한을 그대로 코드로 옮긴 값이라, 올리면 이미 내린
   결정을 소급해서 부정하게 된다. 1차 거름망의 실패비용은 '좋은 사람을 버리는 쪽'이
   더 크므로 관대한 쪽에 둔다. */
export const PASS_RATIO = 0.5
const RANK_B_RATIO = 0.7
const RANK_A_RATIO = 0.85

/* 점수 하한 — 충족률만으로 자르면 요건 절반은 맞췄는데 이력서 자체가 빈약한 사람이
   통과한다. 충족률은 요건 항목 수의 비율일 뿐이라 항목이 적으면 1~2개 차이로 50%를 넘는다. */
export const MIN_SCORE = 55

export const RANKS = { A: 'A', B: 'B', C: 'C', OUT: '탈락' }

/* ─── 1차 거름망: 코드 점수 ─────────────────────────────────────────────
   여기서 하는 일은 순위 매기기가 아니라 '명백히 아닌 사람 걷어내기'다. 20명까지만
   좁히면 되고 진짜 판정은 다음 단계라, 가중치는 굵게만 잡는다. */

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// 짧은 토큰은 부분일치가 위험하다 — "R"·"Go"·"C" 는 아무 문장에나 들어 있다.
const hasToken = (hay, raw) => {
  const t = String(raw || '').toLowerCase().trim()
  if (!t) return false
  if (t.length >= 4) return hay.includes(t)
  return new RegExp(`(^|[^a-z0-9+#.])${escapeRe(t)}([^a-z0-9+#.]|$)`).test(hay)
}

export function haystackOf(p) {
  const s = p.resume_summary || {}
  return [
    p.headline, p.position, p.major, p.university, s.edu_ko,
    ...asSkills(p.skills),
    ...asExperiences(p.experiences).map((e) => `${e?.title || ''} ${e?.company || ''}`),
    ...(Array.isArray(s.bullets) ? s.bullets : []),
  ].filter(Boolean).join(' ').toLowerCase()
}

export function prefilterScore(p, c) {
  const hay = haystackOf(p)
  const hit = (list) => (list || []).filter((k) => hasToken(hay, k))

  let score = 0
  // 직무가 맞으면 크게 — 같은 스킬을 써도 직무가 다르면 다른 사람이다
  if ((c.positions || []).includes(p.position)) score += 30

  const must = hit(c.must_skills)
  if ((c.must_skills || []).length) score += (must.length / c.must_skills.length) * 40
  score += Math.min(hit(c.nice_skills).length * 4, 16)
  score += Math.min(hit(c.keywords).length * 3, 15)

  // 연차 — 범위 밖이라고 버리지는 않는다(요건 하나일 뿐이다)
  const y = p.yoe_months == null ? null : p.yoe_months / 12
  if (y != null) {
    const { lo, hi } = yoeWindow(c.yoe_min, c.yoe_max)
    if (lo != null && y < lo) score -= Math.min((lo - y) * 6, 25)
    else if (hi != null && y > hi) score -= Math.min((y - hi) * 2, 10) // 오버스펙은 가볍게만
    else score += 10
  }

  // 어학 — 한국 기업의 베트남 채용이라 실제로 갈리는 조건이다
  if (c.korean === 'required') score += p.korean_cert ? 12 : -15
  else if (c.korean === 'plus' && p.korean_cert) score += 6
  if (c.english === 'required') score += p.english_cert ? 8 : -8
  else if (c.english === 'plus' && p.english_cert) score += 4

  // 카드가 채워지는지 — 주요이력이 없으면 다음 단계에서 볼 게 없다
  if ((p.resume_summary?.bullets || []).length) score += 5

  return score
}

/* ─── 연차 허용창 ───────────────────────────────────────────────────── */

export function yoeWindow(min, max) {
  if (min == null && max == null) return { lo: null, hi: null }
  const lo = min == null ? null : Math.max(min - 1, min * 0.5)
  const hi = max == null ? (min == null ? null : min + 4) : max + 1
  return { lo, hi }
}

export const yoeWithin = (years, c) => {
  const { lo, hi } = yoeWindow(c.yoe_min, c.yoe_max)
  if (lo == null && hi == null) return null
  if (years == null) return null
  return (lo == null || years >= lo) && (hi == null || years <= hi)
}

/* ─── 2차: LLM 판정 보정 + 등급 산출 ─────────────────────────────────── */

const REQ_STOPWORDS = new Set([
  'experience', 'experiences', 'with', 'and', 'or', 'the', 'an', 'in', 'of', 'to', 'for', 'on',
  'using', 'use', 'developing', 'develop', 'development', 'knowledge', 'understanding',
  'years', 'year', 'ability', 'related', 'relevant', 'required', 'requirement',
  '경험', '능력', '이해', '가능', '보유', '우대', '필수',
])

const reqTokens = (s) => new Set(
  String(s).toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9가-힣.+#]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !REQ_STOPWORDS.has(t)),
)

// 같은 요건을 가리키는 두 문장인지 — 모델이 충족·미달 양쪽에 같은 요건을 적는 일이 잦다
function sameRequirement(a, b) {
  const ta = reqTokens(a); const tb = reqTokens(b)
  if (!ta.size || !tb.size) return false
  let inter = 0
  ta.forEach((t) => { if (tb.has(t)) inter++ })
  return inter / Math.min(ta.size, tb.size) >= 0.6
}

const isYoeRequirement = (s) => /(\d+\s*[-–~+]?\s*\d*\s*(년|years?|yrs?))|(경력\s*\d)/i.test(String(s))

/* JD 에 우대사항이 없으면 우대 조건은 충족한 것으로 본다 — 그러지 않으면 우대사항을
   안 쓴 JD 에서는 A 등급이 구조적으로 도달 불가능해진다. */
function rankOf(ratio, score, preferredMetCount, jdHasPreferred) {
  const preferredOk = preferredMetCount > 0 || !jdHasPreferred
  if (ratio < PASS_RATIO || score < MIN_SCORE) return RANKS.OUT
  if (ratio < RANK_B_RATIO) return RANKS.C
  if (ratio < RANK_A_RATIO) return RANKS.B
  return preferredOk ? RANKS.A : RANKS.B
}

/* LLM 원본 판정 → 보정된 결과. 등급과 점수는 여기서 정해진다.
   raw: { met[], missing[], preferred_met[], score_breakdown{}, why }
   c:   criteria (yoe_min/yoe_max/preferred) */
export function judge(raw, c, years) {
  const met = [...(raw.met || [])]
  let missing = [...(raw.missing || [])]

  // 보정 1 — 충족 목록과 겹치는 미달 항목 제거
  missing = missing.filter((m) => !met.some((x) => sameRequirement(m, x)))

  // 보정 2 — 허용창 안이면 연차 요건은 충족으로 옮긴다(지우지 않는다: 분모에 남아야 한다)
  const within = yoeWithin(years, c)
  if (within === true) {
    const moved = missing.filter(isYoeRequirement)
    if (moved.length) {
      missing = missing.filter((m) => !isYoeRequirement(m))
      met.push(...moved)
    }
  }

  const b = raw.score_breakdown || {}
  const clamp = (v, max) => Math.max(0, Math.min(max, Number(v) || 0))
  const score = Math.round(
    clamp(b.requirements_match, 40) + clamp(b.experience_relevance, 30) +
    clamp(b.skills_alignment, 20) + clamp(b.career_trajectory, 10),
  )

  const total = met.length + missing.length
  const ratio = total > 0 ? met.length / total : 0
  const preferredMet = (raw.preferred_met || []).length
  const rank = rankOf(ratio, score, preferredMet, !!(c.preferred || []).length)

  return { rank, score, ratio, met, missing, preferredMet, within, why: String(raw.why || '').trim() }
}
