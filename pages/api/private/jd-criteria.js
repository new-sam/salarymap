import OpenAI from 'openai'

/* JD 원문 → 조건. /private/showcasing 의 첫 단계다.

   레퍼런스(ktc-support)는 JD 를 이미 칸이 나뉜 채로 받는다 — 지원자격 / 우대사항 /
   희망 경력 / 주요 업무. 그래서 프롬프트가 "지원 자격 칸을 읽어라"라고 말할 수 있다.
   여기는 그 전제가 없다. 고객사가 붙여넣는 건 메일 한 통일 수도, 노션 문서일 수도,
   베트남어 PDF 일 수도, 두 줄짜리 메모일 수도 있다.

   그래서 이 단계가 따로 있다. 칸을 가정하는 대신 아무 형식의 글에서 칸을 만들어 낸다.
   요건 문장을 여기서 뽑아 두면 다음 단계(판정)는 레퍼런스와 똑같은 모양이 된다 —
   "요건 목록 대 이력서".

   두 단계로 나눈 두 번째 이유는 화면이다. 한 번에 후보까지 돌려주면 로딩 중에 보여줄 게
   돌아가는 동그라미뿐인데, 조건을 먼저 받아 두면 "이렇게 이해했습니다"를 띄운 채로
   이력서를 뒤질 수 있다. 조건이 틀렸으면 후보를 다 보기 전에 알아챈다.

   저장하지 않는다(jd-extract 와 같은 이유). */

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// user_profiles.position 의 실제 분포에서 뽑은 값들(이력서 보유 1,000건 표본).
// 파서가 시기별로 다른 enum 을 써서 'AI/Data'(구) 와 'AI Engineer'(신) 가 섞여 있다 —
// 둘 다 남겨 둔다. 목록 밖의 값을 지어내면 매칭에서 한 명도 안 걸리므로 여기서만 고르게 한다.
const POSITIONS = [
  'Fullstack', 'Backend', 'Frontend', 'Web', 'Mobile', 'DevOps', 'Cloud', 'Embedded', 'Game',
  'QA', 'QA Automation', 'IT Support', 'SysAdmin', 'Network', 'Security Engineer',
  'AI Engineer', 'ML Engineer', 'AI/Data', 'Data Engineer', 'Data Analyst', 'Data Scientist',
  'PM', 'Planning', 'Business Analyst', 'Design', 'UX',
  'Marketing', 'Sales', 'Operations', 'Finance', 'HR', 'Procurement', 'Interpreter',
  'Production Manager', 'Production Worker', 'Warehouse', 'Maintenance', 'Construction', 'QC',
  'Non-IT', 'Other',
]

const SYSTEM = `당신은 채용 담당자가 아무렇게나 건넨 글에서 후보 검색 조건을 뽑아내는 도구입니다.

들어오는 글은 형식이 정해져 있지 않습니다. 정식 채용공고일 수도, 메일 본문일 수도,
회의 메모 두 줄일 수도 있고, 언어는 한국어·영어·베트남어 중 무엇이든 됩니다.
"자격요건", "우대사항" 같은 제목이 있을 거라고 가정하지 마세요. 제목이 없으면
문장에서 직접 판단하고, 업무 설명만 있으면 그 업무를 하려면 필요한 것을 요건으로 세우되
그런 항목은 문장 끝에 "(추정)"을 붙이세요.

결과는 아래 JSON 하나만 출력하세요.

{
  "title": "이 자리를 한 줄로 (한국어, 20자 내외). 예: 하노이 백엔드 개발자",
  "positions": ["아래 목록에서만 고른 값. 가장 맞는 것부터 최대 3개"],
  "requirements": [
    "이 사람이 갖춰야 할 것을 한 문장씩. 한국어. 3~8개.",
    "글에 직접 적힌 것을 먼저 쓰고, 업무 설명에서 유추한 것은 끝에 (추정) 을 붙입니다.",
    "한 문장에 요건 하나만 담습니다. 'A 또는 B' 는 한 문장으로 둡니다(둘 중 하나면 충족이므로)."
  ],
  "preferred": ["있으면 좋은 것. 글에 그런 말이 없으면 빈 배열", "최대 5개"],
  "must_skills": ["필수 기술·도구. 이력서에 적힐 법한 표기로. 최대 8개"],
  "nice_skills": ["있으면 좋은 기술. 최대 8개"],
  "keywords": ["기술 외 단서 — 도메인·산업·업무 성격. 이력서 본문에 나올 법한 단어. 최대 8개"],
  "yoe_min": 숫자(년) 또는 null,
  "yoe_max": 숫자(년) 또는 null,
  "korean": "required" | "plus" | "none",
  "english": "required" | "plus" | "none",
  "note": "위 칸에 못 담은 조건 한 줄 (근무지·고용형태·연봉 등). 없으면 빈 문자열"
}

positions 목록: ${POSITIONS.join(', ')}

규칙:
- 글에 없는 조건을 지어내지 마세요. 연차가 안 적혀 있으면 yoe_min/yoe_max 는 null 입니다.
  단, requirements 는 3개 미만이면 후보를 가릴 수 없으므로 업무·직무에서 유추해 (추정) 으로 채웁니다.
- 요건을 잘게 쪼개 부풀리지 마세요. 항목이 늘수록 통과선이 실제보다 높아집니다.
- 스킬은 이력서에 적히는 표기 그대로 쓰세요("리액트" 말고 "React", "자바" 말고 "Java").
- 한국 기업의 베트남 채용입니다. 한국어·영어 요구를 놓치지 마세요. 명시가 없으면 "none" 입니다.
- JSON 만 출력하세요.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })

  const jd = String(req.body?.jd || '').trim()
  if (jd.length < 30) return res.status(400).json({ error: 'JD 내용이 너무 짧습니다' })

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.1,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: jd.slice(0, 12000) },
      ],
    })
    const raw = JSON.parse(completion.choices[0].message.content)

    // 모델이 목록 밖의 값이나 이상한 길이를 뱉어도 여기서 자른다 — 다음 단계는
    // 이 객체를 그대로 믿고 점수를 매긴다.
    const list = (v, n, len = 120) => (Array.isArray(v) ? v : []).map((x) => String(x).trim().slice(0, len))
      .filter(Boolean).slice(0, n)
    const num = (v) => (typeof v === 'number' && v >= 0 && v <= 40 ? Math.round(v * 10) / 10 : null)
    const lvl = (v) => (['required', 'plus', 'none'].includes(v) ? v : 'none')

    const requirements = list(raw.requirements, 8, 160)
    if (requirements.length < 2) {
      // 요건이 한 줄뿐이면 충족률이 0% 아니면 100% 로만 나온다 — 순위가 안 생긴다.
      return res.status(400).json({ error: '조건을 읽어내지 못했습니다 — 어떤 일을 맡길 자리인지 한두 줄만 더 적어 주세요' })
    }

    return res.status(200).json({
      criteria: {
        title: String(raw.title || '').slice(0, 60),
        positions: list(raw.positions, 3).filter((p) => POSITIONS.includes(p)),
        requirements,
        preferred: list(raw.preferred, 5, 160),
        must_skills: list(raw.must_skills, 8, 40),
        nice_skills: list(raw.nice_skills, 8, 40),
        keywords: list(raw.keywords, 8, 40),
        yoe_min: num(raw.yoe_min),
        yoe_max: num(raw.yoe_max),
        korean: lvl(raw.korean),
        english: lvl(raw.english),
        note: String(raw.note || '').slice(0, 120),
        // 추정으로 채운 요건 수 — 화면에서 "JD가 짧아 넓게 잡았습니다"를 말하는 근거
        inferred: requirements.filter((r) => r.includes('추정')).length,
      },
    })
  } catch (e) {
    return res.status(500).json({ error: e.message || 'JD를 읽지 못했습니다' })
  }
}
