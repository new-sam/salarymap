// JD 텍스트 → GPT 필터 추출 → 인재풀 발송 가능 인원 실측.
// Slack 풀봇(pages/api/slack/pool-bot.js)과 CLI(scripts/outreach/pool-estimate.mjs) 공용.
// 카운트 기준은 recommend 캠페인 표준과 동일: 이력서 보유 + 이메일 有 + unsub 제외
// + likelion 제외 + 이메일 중복 최신 1건. 숫자는 실측, JD→필터 매핑만 GPT 추정.
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const sb = () => createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)

// Supabase 1000행 캡 — 전량 페이지네이션(.order 필수)
async function fetchAll(build) {
  const PAGE = 1000
  let all = [], from = 0
  while (true) {
    const { data, error } = await build().range(from, from + PAGE - 1)
    if (error) throw error
    all = all.concat(data || [])
    if (!data || data.length < PAGE) break
    from += PAGE
  }
  return all
}

const FILTER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    position_summary: { type: 'string', description: '포지션 한 줄 요약 (한국어, 예: "AI 비전 엔지니어 (드론·로봇)")' },
    core_roles: { type: 'array', items: { type: 'string' }, description: '포지션 그 자체에 해당하는 직군 값' },
    adjacent_roles: { type: 'array', items: { type: 'string' }, description: '직군은 다르지만 수행 가능성 있는 인접 직군 값' },
    skill_keywords: { type: 'array', items: { type: 'string' }, description: '적합 후보 이력서에 나타날 스킬·툴·자격증 키워드 8~20개 (영어 소문자, 베트남어 병기 가능)' },
    min_yoe_months: { type: 'integer', description: '지원 자격의 최소 경력 개월수. 명시 없거나 인턴이면 0' },
    korean_required: { type: 'boolean', description: '한국어가 지원 자격(필수)인지. 우대는 false' },
    english_required: { type: 'boolean', description: '영어가 지원 자격(필수)인지. 우대는 false' },
  },
  required: ['position_summary', 'core_roles', 'adjacent_roles', 'skill_keywords', 'min_yoe_months', 'korean_required', 'english_required'],
}

export async function extractFilters(jdText, roleVocab) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0,
    response_format: { type: 'json_schema', json_schema: { name: 'pool_filters', strict: true, schema: FILTER_SCHEMA } },
    messages: [
      {
        role: 'system',
        content: `베트남 인재풀 대상 채용 JD에서 후보 검색 필터를 추출한다.
core_roles/adjacent_roles 는 반드시 아래 목록의 값만 그대로 사용 (괄호 숫자 = 그 직군 보유 인원):
${roleVocab.map(([r, n]) => `${r}(${n})`).join(', ')}

규칙:
- core_roles: 포지션 명칭에 직접 해당하는 직군만 (보통 1~4개). 같은 의미의 값이 여럿이면 인원 많은 쪽 선택.
- adjacent_roles: 스킬이 겹쳐 전환 가능한 직군 (예: 비전 AI ← Backend/Embedded, 네트워크 ← SysAdmin/DevOps).
- skill_keywords: 이력서 텍스트 부분일치 검색에 쓴다(2개 이상 일치해야 후보로 침). 구체적 툴·프레임워크·라이브러리·자격증명 8개 이상 (예: opencv, pytorch, yolo, tensorflow, ccna, fortinet). "data analysis" 같은 일반 문구는 넣지 말 것.
- 언어: "필수/지원 자격"에 있을 때만 required=true. 우대 사항이면 false. 베트남어는 현지 풀이라 무시.`,
      },
      { role: 'user', content: String(jdText).slice(0, 8000) },
    ],
  })
  const f = JSON.parse(completion.choices[0].message.content)
  const valid = new Set(roleVocab.map(([r]) => r))
  f.core_roles = (f.core_roles || []).filter((r) => valid.has(r))
  f.adjacent_roles = (f.adjacent_roles || []).filter((r) => valid.has(r) && !f.core_roles.includes(r))
  return f
}

const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const koTextRe = /(korean|tiếng hàn|topik|한국어)/i
const roles = (p) => new Set([p.position, ...(p.desired_roles || [])].filter(Boolean))
const hasAny = (p, arr) => [...roles(p)].some((r) => arr.includes(r))
const txt = (p) => (JSON.stringify(p.skills || '') + ' ' + String(p.position || '') + ' ' + String(p.resume_summary || '')).toLowerCase()
const locOf = (p) => {
  const s = String(p.location || '').toLowerCase()
  if (/(hà nội|ha noi|hanoi|\bhn\b)/.test(s)) return '하노이'
  if (/(đà nẵng|da nang|danang)/.test(s)) return '다낭'
  if (/(h[ồo]\s*ch[íi]\s*minh|hcm|sài gòn|sai gon|thủ đức|thu duc|bình dương|binh duong|đồng nai|dong nai|biên hòa|bien hoa)/.test(s)) return 'HCMC권'
  if (!s.trim()) return '미기재'
  return '기타'
}
const yBucket = (m) => (m == null ? '미상' : m < 12 ? '1y미만' : m < 36 ? '1-3y' : m < 60 ? '3-5y' : '5y+')
const dist = (arr, fn) => {
  const m = {}
  for (const p of arr) m[fn(p)] = (m[fn(p)] || 0) + 1
  return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')
}

// 콜드메일 기준 풀: 이력서 보유 + unsub 제외 + likelion 제외 + 이메일 중복 최신 1건
export async function fetchBase() {
  const client = sb()
  const [pool, unsubs] = await Promise.all([
    fetchAll(() => client.from('user_profiles')
      .select('id,email,position,desired_roles,yoe_months,location,english_cert,korean_cert,is_resume_public,skills,resume_summary')
      .not('email', 'is', null).not('resume_url', 'is', null).order('created_at', { ascending: false })),
    fetchAll(() => client.from('events').select('user_id').eq('event', 'coldmail_unsub').not('user_id', 'is', null).order('id')),
  ])
  const unsubSet = new Set(unsubs.map((r) => r.user_id))
  const seen = new Set()
  const base = []
  for (const p of pool) {
    if (!p.email || /likelion/i.test(p.email)) continue
    const e = p.email.toLowerCase()
    if (seen.has(e) || unsubSet.has(p.id)) continue
    seen.add(e)
    base.push(p)
  }
  return base
}

// 직군 어휘는 상수가 아니라 실데이터에서 뽑는다 — 프로필에 실제 저장된 값과
// 어긋나면(예: 'UI/UX Designer' vs 실저장값 'Design') 매치가 0이 되기 때문.
export function roleVocabOf(base) {
  const m = {}
  for (const p of base) for (const r of roles(p)) m[r] = (m[r] || 0) + 1
  return Object.entries(m).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1])
}

export async function countPool(filters, baseArg) {
  const base = baseArg || await fetchBase()

  for (const p of base) p.__t = txt(p)

  // GPT 키워드는 프롬프트로 막아도 범용 문구("python", "data analysis")가 섞인다 —
  // 기준 풀 10% 이상에 매치되는 키워드는 판별력 없음으로 보고 데이터 기준으로 자동 제외.
  const kwAll = (filters.skill_keywords || []).map((k) => ({ k, re: new RegExp(escRe(k), 'i') }))
  for (const kw of kwAll) kw.hits = base.filter((p) => kw.re.test(p.__t)).length
  const generic = kwAll.filter((kw) => kw.hits > base.length * 0.1)
  const kws = kwAll.filter((kw) => kw.hits <= base.length * 0.1)
  const skillHits = (p) => kws.filter((kw) => kw.re.test(p.__t)).length
  // 스킬 단독 경유는 2개 이상 일치, 인접 직군은 스킬 증거 1개 이상(키워드가 없으면 직군만으로)
  const skillOk = (p) => kws.length > 0 && skillHits(p) >= Math.min(2, kws.length)
  const adjOk = (p) => hasAny(p, filters.adjacent_roles) && (kws.length === 0 || skillHits(p) >= 1)
  const hardOk = (p) =>
    (!filters.min_yoe_months || (p.yoe_months ?? 0) >= filters.min_yoe_months) &&
    (!filters.korean_required || p.korean_cert || koTextRe.test(p.__t)) &&
    (!filters.english_required || p.english_cert)

  const hard = base.filter(hardOk)
  const core = hard.filter((p) => hasAny(p, filters.core_roles))
  const expanded = hard.filter((p) => hasAny(p, filters.core_roles) || adjOk(p) || skillOk(p))
  // "직군 무관 상한"은 언어 필수조건이 있을 때만 의미 있다 — 언어는 업무 자체의
  // 희소 자원이지만, 경력만 거른 상한은 무관 직군까지 포함한 허수가 되기 때문.
  const hasLangFilter = !!(filters.korean_required || filters.english_required)

  return {
    basePool: base.length,
    core: core.length,
    expanded: expanded.length,
    ceiling: hard.length,
    hasLangFilter,
    headlineMax: hasLangFilter ? hard.length : expanded.length,
    coreLoc: dist(core, locOf),
    coreYoe: dist(core, (p) => yBucket(p.yoe_months)),
    coreKo: core.filter((p) => p.korean_cert).length,
    coreEn: core.filter((p) => p.english_cert).length,
    usedKeywords: kws.map((kw) => kw.k),
    droppedKeywords: generic.map((kw) => kw.k),
  }
}

export async function estimatePool(jdText) {
  const base = await fetchBase()
  const filters = await extractFilters(jdText, roleVocabOf(base))
  const counts = await countPool(filters, base)
  return { filters, counts }
}

export function formatSlackReply({ filters, counts }) {
  const f = []
  if (filters.min_yoe_months) f.push(`경력 ${Math.round(filters.min_yoe_months / 12 * 10) / 10}y+`)
  if (filters.korean_required) f.push('한국어 필수')
  if (filters.english_required) f.push('영어 필수')
  const hardLabel = f.length ? f.join('·') : '없음'
  const lines = [
    `:bar_chart: *${filters.position_summary}* — 예상 발송 풀 (실측)`,
    `*코어 ${counts.core}명, 확장하면 ${counts.headlineMax}명까지 발송 가능*`,
    '',
    `• 코어(직군 매치 ${filters.core_roles.join('/') || '-'}): ${counts.core}명`,
    `• 확장(+인접 ${filters.adjacent_roles.join('/') || '-'} 또는 스킬 매치): ${counts.expanded}명`,
  ]
  if (counts.hasLangFilter) lines.push(`• 상한(필수조건 ${hardLabel}만 적용, 직군 무관): ${counts.ceiling}명`)
  if (counts.core > 0) {
    lines.push(`• 코어 거주지: ${counts.coreLoc}`)
    lines.push(`• 코어 경력: ${counts.coreYoe} · 영어인증 ${counts.coreEn} · 한국어인증 ${counts.coreKo}`)
  }
  lines.push('')
  const kwLabel = (counts.usedKeywords.join(', ') || '-') +
    (counts.droppedKeywords.length ? ` (범용이라 제외: ${counts.droppedKeywords.join(', ')})` : '')
  lines.push(`적용 필터 — 필수조건: ${hardLabel} / 스킬 키워드: ${kwLabel}`)
  lines.push(`_기준 풀 ${counts.basePool.toLocaleString()}명(이력서 보유·unsub 제외). 숫자는 프로필 실측이지만 JD→필터 매핑은 GPT 추정이므로 필터가 어긋나 보이면 승주에게 확인._`)
  return lines.join('\n')
}
