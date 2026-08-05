import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { asSkills, asExperiences } from '../../../lib/talentCategory'
import { prefilterScore, judge, yoeWindow, RANKS } from '../../../lib/jdMatch'

/* 조건(jd-criteria 결과) → 인재 5명.

   두 단계다. 코드가 1,400여 명을 20명으로 좁히고, 그 20명만 모델이 요건별로 본다.
   전원을 모델에 넣을 수는 없고(비용·시간), 코드 점수만으로 5명을 뽑으면 "왜 이 사람"에
   답할 수 없다 — 점수는 키워드가 몇 개 겹쳤는지일 뿐이다.

   등급과 점수는 모델이 아니라 lib/jdMatch 의 코드가 낸다(그 이유는 거기 주석에).
   모델이 하는 일은 요건 하나하나에 대해 '이력서에 있나/없나'를 답하는 것뿐이다.

   내보내는 필드는 화면 카드에 그리는 것뿐이다. 이름·이메일·이력서 URL 은 여기서
   아예 SELECT 하지 않는다 — 안 읽으면 샐 수 없다. 이 화면은 주소만 감춘 비공개라
   응답에 담기는 순간 링크가 새면 같이 샌다. */

export const config = { maxDuration: 60 }

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// full_name·email·resume_url 은 일부러 없다. 카드에 안 그리는 값이다.
const COLUMNS = 'id, headline, position, yoe_months, university, verified_school_name, major, ' +
  'photo_url, skills, experiences, english_cert, korean_cert, resume_summary, role'

const SCREEN_N = 20 // 모델이 실제로 읽는 인원
const PICK_N = 5

async function fetchPool() {
  const all = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('user_profiles').select(COLUMNS)
      .not('resume_url', 'is', null).range(from, from + 999)
    if (error) throw error
    all.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return all.filter((p) => p.role !== 'hr')
}

/* 모델에게 보여줄 한 사람 — 이력서 원문이 아니라 파서가 뽑아 둔 요약이다.
   PDF 20장을 매번 받아 넣으면 이 화면은 1분을 넘긴다. */
function profileText(p) {
  const s = p.resume_summary || {}
  const exps = asExperiences(p.experiences)
  const y = p.yoe_months == null ? null : Math.round((p.yoe_months / 12) * 10) / 10
  return [
    `직무: ${p.position || '미상'}${p.headline ? ` (${p.headline})` : ''}`,
    `경력: ${y == null ? '미상' : `${y}년`}`,
    exps.length ? `경력사항: ${exps.slice(0, 6).map((e) => `${e?.title || ''}@${e?.company || ''}(${e?.months || '?'}개월)`).join(', ')}` : '',
    `스킬: ${asSkills(p.skills).join(', ') || '없음'}`,
    (s.bullets || []).length ? `주요이력: ${s.bullets.join(' / ')}` : '',
    `학력: ${[s.degree, p.university || p.verified_school_name, p.major || s.edu_ko].filter(Boolean).join(' · ') || '미상'}`,
    `어학: ${[p.english_cert && `영어 ${p.english_cert}`, p.korean_cert && `한국어 ${p.korean_cert}`].filter(Boolean).join(' / ') || '기재 없음'}`,
  ].filter(Boolean).join('\n')
}

/* 판정 프롬프트. 읽기 규칙은 ktc-support 의 스크리닝 프롬프트에서 가져왔다 —
   이 규칙들이 없으면 모델이 요건을 실제보다 세게 읽어서(또는→그리고, 이해→경험)
   멀쩡한 후보가 통째로 떨어진다. */
const screenPrompt = (c, text) => `당신은 1차 서류 스크리닝을 하는 채용 담당자입니다.
아래 요건 하나하나에 대해 이 후보가 충족하는지만 판정하세요. 등급은 매기지 않습니다.

## 요건
${c.requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}
${c.preferred.length ? `\n## 우대사항\n${c.preferred.map((r) => `- ${r}`).join('\n')}` : ''}
${c.yoe_min != null || c.yoe_max != null ? `\n## 요구 경력\n${c.yoe_min ?? 0}~${c.yoe_max ?? '제한없음'}년` : ''}

## 후보 (이력서에서 뽑은 요약 — 원문 전체가 아닙니다)
${text}

읽기 규칙 — 요건은 적힌 만큼만 읽고 절대 더 세게 읽지 마세요:
1. "또는"·"or" 는 택일입니다. 나열된 것 중 하나만 충족해도 그 요건 전체가 충족입니다.
2. "및"·"and" 만 전부를 요구합니다. 택일 목록에 이 해석을 적용하지 마세요.
3. "~같은"·"등"·"예:" 뒤의 목록은 예시입니다. 동등하거나 인접한 도구면 충족입니다.
4. 동사를 구분하세요. "경험" 은 직접 해 본 것을 요구하지만, "이해"·"지식"·"익숙" 은
   개념적 인지만 요구합니다 — 프로젝트 경험을 요구하지 마세요.
5. 요약이 애매하면 미달이 아니라 충족 쪽에 두고 단서를 답니다. 요약은 이력서 원문이
   아니라서 안 적혔을 뿐인 경우가 많습니다. 애매함이 조용히 탈락이 되면 안 됩니다.
6. 요건 하나는 한 번만 셉니다. 같은 요건을 met 과 missing 양쪽에 넣지 마세요.

JSON 만 출력하세요:
{
  "met": ["충족한 요건 문장 그대로"],
  "missing": ["미달이거나 요약에 근거가 없는 요건"],
  "preferred_met": ["충족한 우대사항. 없으면 빈 배열"],
  "score_breakdown": {
    "requirements_match": 0-40,
    "experience_relevance": 0-30,
    "skills_alignment": 0-20,
    "career_trajectory": 0-10
  },
  "why": "이 사람을 왜 보여주는지 한국어 한 문장. 이름은 쓰지 마세요.",
  "strengths": ["이 자리 기준 강점 한국어 2~3개"]
}

점수는 0~100 을 넓게 쓰세요. 후보마다 달라야 합니다 — 5나 10 단위로 뭉뚱그리지 마세요.`

async function screen(c, p) {
  try {
    const r = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.1,
      messages: [{ role: 'user', content: screenPrompt(c, profileText(p)) }],
    })
    return JSON.parse(r.choices[0].message.content)
  } catch {
    return null // 한 명이 실패해도 나머지로 5명을 채운다
  }
}

/* 카드에 그리는 것만. 인재풀 카드(components/admin/TalentPoolView)와 같은 행 구성이되
   이름 자리에 직무가 온다. */
function card(p, v) {
  const s = p.resume_summary || {}
  const skills = asSkills(p.skills)
  const exps = asExperiences(p.experiences)
  return {
    fit: v.score,
    rank: v.rank,
    why: v.why,
    strengths: (v.strengths || []).slice(0, 3),
    met: v.met.length,
    total: v.met.length + v.missing.length,
    missing: v.missing.slice(0, 3),
    photo: p.photo_url || '',
    title: exps[0]?.title || p.headline || p.position || '',
    position: p.position || '',
    yoe: p.yoe_months == null ? null : Math.round((p.yoe_months / 12) * 10) / 10,
    uni: p.university || p.verified_school_name || '',
    edu: [s.degree, s.edu_ko || p.major].filter(Boolean).join(' · '),
    bullets: Array.isArray(s.bullets) ? s.bullets.slice(0, 3) : [],
    english: p.english_cert || '',
    korean: p.korean_cert || '',
    links: Array.isArray(s.links) ? s.links.slice(0, 3) : [],
    skills: skills.slice(0, 3),
    skillsMore: Math.max(0, skills.length - 3),
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })

  // 로그인 없는 경로라 조건 객체를 클라이언트가 쥐고 있다. 모양만 맞춰 받는다 —
  // 여기서 하는 건 JS 필터와 프롬프트 삽입뿐이라 SQL 로 새어 들어갈 곳은 없다.
  const b = req.body?.criteria || {}
  const list = (v, n) => (Array.isArray(v) ? v : []).map((x) => String(x).slice(0, 160)).filter(Boolean).slice(0, n)
  const c = {
    positions: list(b.positions, 3),
    requirements: list(b.requirements, 8),
    preferred: list(b.preferred, 5),
    must_skills: list(b.must_skills, 8),
    nice_skills: list(b.nice_skills, 8),
    keywords: list(b.keywords, 8),
    yoe_min: typeof b.yoe_min === 'number' ? b.yoe_min : null,
    yoe_max: typeof b.yoe_max === 'number' ? b.yoe_max : null,
    korean: ['required', 'plus', 'none'].includes(b.korean) ? b.korean : 'none',
    english: ['required', 'plus', 'none'].includes(b.english) ? b.english : 'none',
  }
  if (c.requirements.length < 2) return res.status(400).json({ error: '조건이 비어 있습니다' })

  try {
    const pool = await fetchPool()

    // 1차 — 코드 점수로 20명. 여기서 하는 건 순위가 아니라 '명백히 아닌 사람' 걷어내기다.
    const short = pool
      .map((p) => ({ p, s: prefilterScore(p, c) }))
      .sort((a, b2) => b2.s - a.s)
      .slice(0, SCREEN_N)

    // 2차 — 20명을 동시에 판정. 순차로 돌리면 이 화면이 1분을 넘긴다.
    const raws = await Promise.all(short.map(({ p }) => screen(c, p)))

    const judged = []
    for (let i = 0; i < short.length; i++) {
      if (!raws[i]) continue
      const { p } = short[i]
      const years = p.yoe_months == null ? null : p.yoe_months / 12
      const v = judge(raws[i], c, years)
      judged.push({ p, v: { ...v, strengths: raws[i].strengths } })
    }

    /* 항상 5명이다. 기준을 넘은 사람을 점수순으로 먼저 채우고, 모자라면 그 아래에서
       가까운 순으로 채운다 — 다만 채워 넣은 사람은 rank 로 표시해서 화면이 "이 사람은
       조건을 다 만족하진 않는다"고 말할 수 있게 한다. 빈 화면을 주는 것보다
       "여기까지가 지금 인재풀"을 보여주는 쪽이 다음 대화를 만든다. */
    const byScore = (a, b2) => b2.v.score - a.v.score
    const passed = judged.filter((x) => x.v.rank !== RANKS.OUT).sort(byScore)
    const rest = judged.filter((x) => x.v.rank === RANKS.OUT).sort(byScore)
    const picks = [...passed, ...rest].slice(0, PICK_N)

    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({
      pool: pool.length,
      screened: judged.length,
      passed: passed.length,
      yoeWindow: yoeWindow(c.yoe_min, c.yoe_max),
      picks: picks.map(({ p, v }) => card(p, v)),
    })
  } catch (e) {
    return res.status(500).json({ error: e.message || '후보를 찾지 못했습니다' })
  }
}
