import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { asSkills, asExperiences } from '../../../lib/talentCategory'
import { prefilterScore, judge, yoeWindow, RANKS } from '../../../lib/jdMatch'
import { verifyToken } from '../../../lib/showcaseToken'

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
   PDF 20장을 매번 받아 넣으면 이 화면은 1분을 넘긴다.

   hideYoe: 연차를 아예 지우고 보여준다. JD 가 연차를 요구하지 않은 자리에서 쓴다 —
   "연차로 줄 세우지 마라"고 문장으로 시켜도 15년차가 5년차 위로 올라왔다. 볼 수 있으면
   본다. 그래서 순위 단계에서는 숫자를 안 준다(경력사항의 개월 수까지). 회사·직함은
   남으므로 무슨 일을 해 왔는지는 그대로 읽힌다. */
function profileText(p, hideYoe) {
  const s = p.resume_summary || {}
  const exps = asExperiences(p.experiences)
  const y = p.yoe_months == null ? null : Math.round((p.yoe_months / 12) * 10) / 10
  return [
    `직무: ${p.position || '미상'}${p.headline ? ` (${p.headline})` : ''}`,
    hideYoe ? '' : `경력: ${y == null ? '미상' : `${y}년`}`,
    exps.length ? `경력사항: ${exps.slice(0, 6).map((e) => `${e?.title || ''}@${e?.company || ''}${hideYoe ? '' : `(${e?.months || '?'}개월)`}`).join(', ')}` : '',
    `스킬: ${asSkills(p.skills).join(', ') || '없음'}`,
    (s.bullets || []).length ? `주요이력: ${s.bullets.join(' / ')}` : '',
    `학력: ${[s.degree, p.university || p.verified_school_name, p.major || s.edu_ko].filter(Boolean).join(' · ') || '미상'}`,
    `어학: ${[p.english_cert && `영어 ${p.english_cert}`, p.korean_cert && `한국어 ${p.korean_cert}`].filter(Boolean).join(' / ') || '기재 없음'}`,
  ].filter(Boolean).join('\n')
}

/* why 는 우리가 후보를 평하는 메모가 아니라 고객사가 그대로 읽는 문장이다. 그대로 두면
   모델이 "~하지 못한다" 같은 평가문을 쓴다 — 우리가 골라서 보내드리는 자리에 그 말투가
   붙으면 후보를 깎는 동시에 우리 추천도 깎는다.
   모자란 점은 굳이 문장으로 쓰지 않는다. 카드의 숫자(자격요건 n/m·우대 n/m)와 '조건 일부
   미달' 표시가 이미 말하고 있어서, 문장까지 같은 말을 하면 두 번 깎는 셈이다. */
const WHY_RULE = `why 쓰는 규칙 — 이 문장은 고객사가 그대로 읽습니다:
- '~합니다' 체 존댓말로 씁니다. '~한다'·'~이다' 로 끝내지 마세요.
- 후보를 낮잡거나 평가하는 표현을 쓰지 마세요("경험이 부족합니다", "충족하지 못합니다").
  모자란 점은 화면의 숫자가 이미 보여 주므로 문장에서는 되풀이하지 않습니다.
- 이 자리에 어떤 점이 맞는지를 씁니다. 사실만 쓰고 없는 경력을 지어내지 마세요.
- 사람 이름은 쓰지 마세요.`

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
  "why": "이 분을 왜 추천하는지 한국어 한 문장 (아래 쓰기 규칙을 지킬 것).",
  "strengths": ["이 자리 기준 강점 한국어 2~3개"]
}

점수는 0~100 을 넓게 쓰세요. 후보마다 달라야 합니다 — 5나 10 단위로 뭉뚱그리지 마세요.

${WHY_RULE}`

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

/* 3차 — 통과자끼리 나란히 놓고 순서를 매긴다.

   2차는 한 명씩 따로 보기 때문에 요건을 다 채운 사람들 사이에서는 전부 만점이 된다.
   실제로 백엔드 JD 하나로 돌려 보니 상위 다섯이 전부 5/5·100점이었다 — 그 상태의
   '5명'은 고른 게 아니라 앞에서 다섯 장을 뜯어 온 것에 가깝다. 사람을 고르는 건
   절대평가가 아니라 비교라서, 마지막 한 번은 같이 놓고 봐야 한다.

   코드가 정한 것은 여기서 안 바뀐다 — 누가 기준을 넘었는지는 이미 정해졌고, 모델은
   그 안에서 순서와 점수·이유만 답한다. 실패하면 코드 순서를 그대로 쓴다. */
const RANK_N = 8 // 비교 대상. 5명을 고르는 데 8명이면 충분하고, 더 넣으면 프롬프트만 길어진다

/* 연차를 요구한 JD 와 안 한 JD 는 순위 기준이 다르다. 요구했으면 "그 범위 안에서는
   다 같다"이고, 안 했으면 "연차는 이 자리와 아무 상관이 없다"다. 뒤쪽에서는 후보
   설명에서 연차를 지우고 보여주므로(profileText), 모델이 볼 수 있는 것 자체가 다르다. */
const yoeRule = (c) => (c.yoe_min != null || c.yoe_max != null
  ? `연차는 순위 기준이 아닙니다. 위 후보들은 이미 이 자리가 원하는 연차(${c.yoe_min ?? 0}~${c.yoe_max ?? '제한없음'}년)
안에 있는 사람들입니다 — 그 안에서는 7년차가 4년차보다 나은 후보가 아닙니다. 오래 했다는 것을
순위의 근거로 삼지 말고, why 에도 "경력이 풍부하다"·"N년 이상"처럼 연차를 말하지 마세요.`
  : `이 자리는 연차를 요구하지 않았습니다. 그래서 후보 설명에도 연차를 적지 않았습니다 —
직함이나 회사 수로 연차를 짐작해 순위를 매기지 마세요. 갈리는 건 하던 일이 이 자리와
얼마나 겹치는가입니다. why 에도 연차나 "경력이 풍부하다"를 쓰지 마세요.`)

const rankPrompt = (c, rows) => `아래는 이미 1차 요건을 통과한 후보들입니다.
${c.title ? `채용하는 자리: ${c.title}\n` : ''}
## 요건
${c.requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}

${c.preferred.length ? `## 우대사항\n${c.preferred.map((r) => `- ${r}`).join('\n')}\n` : ''}
## 후보
${rows.map((r) => `[${r.i}] 자격요건 ${r.met}/${r.total} 충족${c.preferred.length ? ` · 우대사항 ${r.pref}/${c.preferred.length} 충족` : ''}\n${r.text}`).join('\n\n')}

이 자리에 지금 데려왔을 때 가장 잘할 사람 순으로 5명을 고르세요.
${c.preferred.length
  ? `순서의 첫 기준은 우대사항입니다. 자격요건은 다들 이미 넘었으므로 더 가릴 것이 없고,
기업이 "그다음은 이걸로 봐 달라"고 적어 둔 칸이 우대사항입니다.
우대사항을 더 많이 채운 사람이 무조건 위입니다 — 다른 면이 아무리 좋아도 우대를 덜 채웠으면
아래입니다. 우대 충족 수가 같을 때만 직무 근접도·최근에 하던 일·쓰던 기술의 겹침으로 가르세요.`
  : '요건은 다들 채웠으므로, 갈리는 건 직무 근접도·최근에 하던 일·쓰던 기술의 겹침입니다.'}

${yoeRule(c)}
기업이 원한 건 맞는 사람이지 가장 오래 한 사람이 아닙니다.

JSON 만 출력하세요:
{"picks":[{"i":후보번호,"fit":0-100,"why":"이 분을 왜 이 순서에 두는지 한국어 한 문장 (아래 쓰기 규칙을 지킬 것)."}]}

fit 은 서로 달라야 합니다 — 다섯이 같은 점수면 순서를 매긴 뜻이 없습니다.

${WHY_RULE}`

async function rank(c, finalists) {
  try {
    const hideYoe = c.yoe_min == null && c.yoe_max == null
    const rows = finalists.map((x, i) => ({
      i,
      met: x.v.met.length,
      total: x.v.met.length + x.v.missing.length,
      pref: x.v.preferredMet,
      text: profileText(x.p, hideYoe),
    }))
    const r = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [{ role: 'user', content: rankPrompt(c, rows) }],
    })
    const out = JSON.parse(r.choices[0].message.content)
    const seen = new Set()
    return (out.picks || [])
      .filter((x) => Number.isInteger(x.i) && x.i >= 0 && x.i < finalists.length && !seen.has(x.i) && seen.add(x.i) !== false)
      .slice(0, PICK_N)
      .map((x) => {
        const f = finalists[x.i]
        /* 점수는 모델 것을 그대로 쓰지 않고 코드 점수(요건 충족률 기반)와 섞는다.
           안 섞으면 요건 3/6 인 사람이 5/6 인 사람 바로 밑에 90점으로 붙는다(실제로 그랬다).
           모델이 보는 건 '누가 더 잘할까'라서 요건을 몇 개 채웠는지는 잊는다 — 그건
           코드가 센 값이므로 코드 쪽에 더 무게를 준다. */
        const given = Math.max(0, Math.min(100, Math.round(Number(x.fit) || f.v.fit)))
        return {
          ...f,
          v: { ...f.v, fit: Math.round(0.6 * f.v.fit + 0.4 * given), why: String(x.why || f.v.why).trim() },
        }
      })
  } catch {
    return null
  }
}

/* 카드에 그리는 것만. 인재풀 카드(components/admin/TalentPoolView)와 같은 행 구성이되
   이름 자리에 직무가 온다. */
/* 스킬 이름 맞추기 — "React.js" 와 "React", "Node.js" 와 "NodeJS" 를 같은 것으로 본다.
   짧은 토큰(Go·C·R)은 포함 검사를 안 한다. "Go" 로 "Google Analytics" 가 걸린다.
   걸린 요건 이름을 돌려주는 이유는 아래 중복 제거 때문이다. */
const normSkill = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9+#]/g, '')
function matchedReq(skill, wanted) {
  const a = normSkill(skill)
  if (!a) return null
  // 정확히 같은 것부터 찾는다 — "Git" 을 놓고 "GitHub" 이 먼저 걸리면 안 된다
  const exact = wanted.find((w) => normSkill(w) === a)
  if (exact) return exact
  return wanted.find((w) => {
    const b = normSkill(w)
    return b && a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a))
  }) || null
}

function card(p, v, c) {
  const s = p.resume_summary || {}
  const exps = asExperiences(p.experiences)

  /* 기준에 든 기술을 앞으로 당긴다. 카드에는 세 개만 보이는데, 정렬을 안 하면 이력서에
     적힌 순서대로 잘려서 정작 고객사가 적은 스택(React·TypeScript)이 "+17" 안에 숨는다.
     걸린 이름은 따로 실어 보낸다 — 화면에서 그것만 표시를 다르게 한다. */
  /* 요건 하나당 하나만 세운다. 안 그러면 "Git" 요건 하나에 Git·GitHub·GitLab 이 다
     걸려서, 카드에 보이는 칩 다섯 중 셋이 같은 말을 하고 정작 다른 기술이 밀려난다. */
  const wanted = [...(c.must_skills || []), ...(c.nice_skills || [])]
  const all = asSkills(p.skills)
  const taken = new Set()
  const hits = []
  for (const x of all) {
    const req = matchedReq(x, wanted)
    if (req && !taken.has(normSkill(req))) { taken.add(normSkill(req)); hits.push(x) }
  }
  const skills = [...hits, ...all.filter((x) => !hits.includes(x))]
  return {
    fit: v.fit,
    rank: v.rank,
    why: v.why,
    strengths: (v.strengths || []).slice(0, 3),
    met: v.met.length,
    total: v.met.length + v.missing.length,
    pref: v.preferredMet,
    prefTotal: v.preferredTotal,
    missing: v.missing.slice(0, 3),
    photo: p.photo_url || '',
    title: exps[0]?.title || p.headline || p.position || '',
    position: p.position || '',
    yoe: p.yoe_months == null ? null : Math.round((p.yoe_months / 12) * 10) / 10,
    /* 학력·포폴은 안 내보낸다. 학교 이름은 한국 기업이 읽어도 어느 정도인지 알 수 없어
       판단을 흐리고, 포폴은 이력서에 링크를 남긴 사람이 드물어 대부분 '-' 한 칸으로만
       남는다 — 다섯 장이 나란히 비어 있으면 그 줄은 정보가 아니라 여백이다.
       카드는 경력·주요이력·외국어·기술 넷이다. */
    bullets: Array.isArray(s.bullets) ? s.bullets.slice(0, 3) : [],
    english: p.english_cert || '',
    korean: p.korean_cert || '',
    // 기준에 걸린 기술이 셋을 넘으면 그만큼 더 보여준다 — 걸린 걸 잘라 내면 표시할 이유가 없다
    skills: skills.slice(0, Math.max(3, Math.min(hits.length, 5))),
    skillsMore: Math.max(0, skills.length - Math.max(3, Math.min(hits.length, 5))),
    hits, // 이 중 어느 것이 기준에 걸렸는지 — 화면에서 표시를 다르게 한다
  }
}

/* 이 검색을 한 줄로 남긴다 — 상담 문의가 여기에 걸린다.

   남기는 이유는 기록이 아니라 지목이다. 화면의 카드에는 후보 id 가 없고(위 card 참조)
   앞으로도 없을 것이라, 고객사가 "이 사람으로 상담하고 싶다"고 눌렀을 때 그게 누구인지
   알아낼 방법이 이 표뿐이다. picks 의 순서가 곧 카드 번호라, 문의는 인덱스만 올린다.

   저장하는 건 criteria 와 후보 id 다. JD 원문은 여기서도 안 남긴다 — 그건 고객사가
   아직 안 낸 자리의 문서이고, 우리가 필요한 건 '무슨 조건으로 누굴 보여줬나'뿐이다.

   기업명은 클라이언트가 보낸 문자열이 아니라 토큰 서명을 확인해서 얻는다. 로그인이
   없는 경로라 문자열을 그냥 믿으면 아무 회사 이름이나 적힌 검색 기록이 쌓인다.
   날린 링크(showcase_links 에서 지운 것)는 화면이 c 를 아예 안 보내므로 여기서
   기업이 안 붙는다 — 이벤트 쪽 규칙과 같다.

   실패해도 던지지 않는다. 검색 결과를 못 돌려주는 것과 기록을 못 남기는 것은 무게가
   다르다. 대신 sid 가 null 로 나가고, 화면은 그때 문의 버튼을 감춘다 — 누른 뒤에
   실패하는 것보다 처음부터 없는 편이 낫다. */
async function saveSearch({ token, criteria, picks, pool, screened, passed }) {
  try {
    const v = token ? verifyToken(token) : null
    const { data, error } = await supabase.from('showcase_searches').insert({
      token: v ? token : null,
      company: v ? v.company : null,
      criteria,
      picks: picks.map(({ p }) => String(p.id)),
      pool,
      screened,
      passed,
    }).select('id').single()
    if (error) throw error

    // 문의로 안 이어진 30일 지난 검색 치우기. 크론을 새로 만들지 않고 여기서 부른다 —
    // 쌓이는 자리가 곧 치울 자리다. 실패는 삼킨다(다음 검색이 다시 한다).
    supabase.rpc('purge_showcase_searches').then(() => {}, () => {})

    return data?.id || null
  } catch {
    return null
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
      judged.push({ p, v: { ...v, strengths: raws[i].strengths }, pre: short[i].s })
    }

    /* 항상 5명이다. 기준을 넘은 사람을 점수순으로 먼저 채우고, 모자라면 그 아래에서
       가까운 순으로 채운다 — 다만 채워 넣은 사람은 rank 로 표시해서 화면이 "이 사람은
       조건을 다 만족하진 않는다"고 말할 수 있게 한다. 빈 화면을 주는 것보다
       "여기까지가 지금 인재풀"을 보여주는 쪽이 다음 대화를 만든다. */
    // 순서는 적합점수 → 충족률 → 1차 점수. 마지막 단계까지 두는 건 앞의 둘이 같을 때
    // 순서가 배열 순서(=DB 가 돌려준 순서)로 정해지지 않게 하기 위해서다.
    /* 연차 범위를 벗어난 사람은 뒤로 민다. 기업이 3~5년을 원했으면 10년차는 '더 좋은
       후보'가 아니라 다른 자리 사람이다 — 점수가 높다는 이유로 앞에 오면 안 된다.
       빼지는 않는다. 범위 안에서 5명이 안 나오면 그때는 보여줘야 한다. */
    const inRange = (x) => x.v.within !== false
    /* 순서: 우대사항 충족 수 → 자격요건 충족률 → 점수 → 1차 점수.
       우대가 맨 앞인 이유는 자격요건이 이미 '통과선'으로 쓰였기 때문이다 — 여기 있는 건
       전부 자격을 넘은 사람들이라 자격으로는 더 가릴 것이 없고, 기업이 "그다음은 이걸로
       봐 달라"고 적어 둔 칸이 우대사항이다.
       점수(fit)가 아니라 우대가 먼저다. 점수가 높아도 우대를 못 채웠으면 뒤로 간다. */
    const byFit = (a, b2) => b2.v.preferredMet - a.v.preferredMet || b2.v.ratio - a.v.ratio
      || b2.v.fit - a.v.fit || b2.pre - a.pre
    const byRangeThenFit = (a, b2) => (inRange(b2) ? 1 : 0) - (inRange(a) ? 1 : 0) || byFit(a, b2)
    const passed = judged.filter((x) => x.v.rank !== RANKS.OUT).sort(byRangeThenFit)
    const rest = judged.filter((x) => x.v.rank === RANKS.OUT).sort(byRangeThenFit)
    const ordered = [...passed, ...rest]

    /* 3차 — 통과자가 5명을 넘을 때만 비교한다. 5명 이하면 고를 것이 없다.
       비교 대상은 연차 범위 안인 사람만 넣는다. 범위 밖 사람을 같이 넣으면 모델이
       "경력이 더 풍부하다"는 이유로 그를 1등에 올린다(실제로 그랬다). */
    const finalists = passed.filter(inRange).slice(0, RANK_N)
    const ranked = finalists.length > PICK_N ? await rank(c, finalists) : null
    // 모델이 고른 다섯을 다시 점수순으로 세운다 — 카드가 점수를 달고 있는데 순서가
    // 점수를 안 따라가면 그 숫자를 못 믿게 된다.
    const picks = (ranked?.length === PICK_N ? [...ranked].sort(byFit) : ordered.slice(0, PICK_N))

    // 카드를 그리기 전에 남긴다 — 화면이 문의 버튼을 띄우려면 sid 가 같은 응답에 있어야 한다.
    const sid = await saveSearch({
      token: typeof req.body?.c === 'string' ? req.body.c : null,
      criteria: c,
      picks,
      pool: pool.length,
      screened: judged.length,
      passed: passed.length,
    })

    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({
      sid,
      pool: pool.length,
      screened: judged.length,
      passed: passed.length,
      yoeWindow: yoeWindow(c.yoe_min, c.yoe_max),
      picks: picks.map(({ p, v }) => card(p, v, c)),
    })
  } catch (e) {
    return res.status(500).json({ error: e.message || '후보를 찾지 못했습니다' })
  }
}
