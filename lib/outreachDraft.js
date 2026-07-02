import OpenAI from 'openai'

// 회사별 개인화 콜드메일 초안 생성 — 서버(API)·스크립트 공용 단일 소스.
// 발신자(owner)마다 피치·호칭·서명이 다르다: wsj=salary-fyi 플랫폼(대표님), younghun=인재매칭 인건비절감(채용담당자님).
let _openai
const openai = () => (_openai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY }))

function splitName(s) {
  s = (s || '').trim()
  if (!s) return { en: '', ko: '' }
  if (s.endsWith(')')) {
    let d = 0
    for (let i = s.length - 1; i >= 0; i--) {
      if (s[i] === ')') d++
      else if (s[i] === '(') { d--; if (d === 0) {
        const b = s.slice(0, i).trim(), inn = s.slice(i + 1, -1).trim()
        return /[가-힣]/.test(inn) ? { en: b, ko: inn } : { en: b || inn, ko: '' }
      } }
    }
  }
  return /[가-힣]/.test(s) ? { en: '', ko: s } : { en: s, ko: '' }
}

const COMMON_RULES = `
[공통 규칙]
- 한국어 존댓말. 플레인텍스트(마크다운/HTML/이모지 금지).
- 읽기 쉽게 줄바꿈: 한 문장(또는 짧은 의미 단위)마다 줄바꿈, 블록 사이엔 빈 줄. 여러 문장을 한 줄에 붙이지 말 것.
- 스팸성 표현(무료!!!, 대박 등) 금지, 담백하고 신뢰감 있게.
- ⚠️ 연락처·전화·이메일·회사주소 등 서명 정보와 수신거부 문구는 절대 쓰지 말 것 (Gmail 서명이 자동으로 붙습니다).
- 반드시 JSON 으로만 응답: {"subject": "...", "body": "..."}`

// ── 발신자별 피치 (여기만 고치면 각자 카피가 바뀝니다) ──────────────────
const OWNER_PITCH = {
  // 위승주 — salary-fyi 플랫폼, 리스트=대표님
  wsj: {
    temperature: 0.6,
    system: `당신은 '위승주'로서, 이미 베트남에서 사업을 운영 중인 한국기업 대표에게 보내는 콜드 영업 이메일을 씁니다.
※ 상대는 이미 베트남에서 채용 중 → "인건비가 저렴하다" 류 훅은 절대 쓰지 말 것(이미 앎). 대신 베트남 채용의 실제 페인을 건드릴 것.

[핵심 훅 — 베트남 현지 운영 기업이 반응하는 것들 중 1~2개를 골라 자연스럽게]
- 공고 게재비 0원: 베트남 채용 플랫폼들은 공고 올리는 데 게재비를 받아 한국 대표들에겐 '생돈' 느낌인데, 우리는 등록·게재가 무료.
- No Hire No Pay: 선결제·게재비 없이, 채용이 성사·유지될 때만 비용 발생(안 뽑히면 0원).
- 이탈 리스크 보장: 베트남 인재 조기 이탈이 잦은데, 수습/보증 기간 내 이탈 시 무상 재매칭(3개월 미유지 시 0원).
- 검증된 인재: 베트남 현직자 실연봉 데이터 기반이라 시장가 투명·지원자 질 높음(IT·개발 강점, 디자인·마케팅·사무 등도).

[작성]
- ⚠️ 도메인/서비스명(salary-fyi)부터 꺼내지 말 것. 위 '가치'를 먼저 말하고, 서비스명은 뒤에 딱 한 번 가볍게.
- 본문 시작 세 줄(각 줄 줄바꿈):
안녕하세요, {담당자} 대표님.
Likelion(멋쟁이사자처럼)의 위승주입니다.
처음 인사드립니다.
  (담당자 이름 모르면 첫 줄 "안녕하세요, 대표님.")
- 인사 다음, 그 회사 사업/업종을 한 줄 자연스럽게 언급(과장/아부 금지).
- 위 훅 1~2개를 핵심으로 짧게. 전체 4~6문장.
- CTA 하나: "관심 있으신 포지션만 간단히 회신 주시면, 확보 가능한 인재와 조건을 정리해 드리겠습니다." (부담 없이)
- 끝맺음 반드시 "감사합니다." 줄바꿈 후 "위승주 드림".
- 제목 30자 이내: '게재비 0원' / '채용 성사 시에만' 등 혜택을 살짝, 회사명 녹여도 좋음, 낚시성 금지.
${COMMON_RULES}`,
  },

  // 남영훈 — 인재매칭(인건비 절감), 리스트=채용 담당자
  younghun: {
    temperature: 0.4,
    system: `당신은 '멋쟁이사자처럼 베트남 인재 매칭팀 남영훈 팀장'입니다. 아래 내용을 회사에 맞게 자연스럽게 다듬어 콜드 영업 이메일을 작성하세요. 핵심 수치·문구는 그대로 유지하세요.

[반드시 이 순서/내용 포함]
1) 인사(두 줄):
안녕하세요, 채용 담당자님.
멋쟁이사자처럼 베트남 인재 매칭팀 남영훈 팀장입니다.
2) "현재 채용 플랫폼 통해 열어놓으신 채용 공고 확인하고 연락드리게 되었습니다." (회사 업종을 알면 한 줄 자연스럽게 곁들임)
3) 핵심: 필요 역량을 모두 갖춘 인재를 베트남 인재 채용으로 진행 시 국내 인건비의 30%(1/3) 수준으로 채용 가능한 점 아시는지 물어보기. (베트남은 인도와 함께 IT 인력 수준이 세계 최고도화 국가)
3-1) 그 바로 다음 줄에 정확히 "[[IMAGE]]" 한 줄만 단독으로 출력할 것. (인건비 비주얼이 자동으로 들어가는 자리 — 이 표시는 절대 변형·설명하지 말고 그대로 둘 것)
4) 고객사 예시: IT·게임(네이버·슈퍼센트), 대기업·글로벌(삼성·엔비디아), AI 스타트업(지노시스·넥사코드), 동남아 진출(헬로 사이언스 에듀·논스테레오타입) 등.
5) 절감 예시(수치 그대로):
- 5년차 풀스택 개발자: 국내 월 500만원 → 베트남 월 150만원
- 3년차 퍼포먼스 마케터: 국내 월 350만원 → 베트남 월 105만원
- 1년차 디자이너: 국내 월 250만원 → 베트남 월 75만원
(이외 IT 전직군 채용 가능)
6) 실적: 9개월+ 평균 근속 · 83% 재채용률 · 4.5/5 만족도
7) CTA: "베트남 인재 채용에 관심 있으신 포지션만 간단히 회신 주시면, 확보 가능한 인재와 인건비 수준·견적을 전달드리겠습니다."
8) 끝맺음 반드시 "감사합니다." 줄바꿈 후 "남영훈 드림".
- 제목 30자 이내: 베트남 인재로 인건비 절감 취지, 회사명 살짝 녹여도 좋음. 낚시성 금지.
${COMMON_RULES}`,
  },
}

export async function generateDraft(lead, ownerKey = 'wsj') {
  const pitch = OWNER_PITCH[ownerKey] || OWNER_PITCH.wsj
  const c = splitName(lead.company_name || ''), n = splitName(lead.contact_name || '')
  const ctx = {
    회사명: c.ko || c.en || lead.company_name,
    담당자: n.ko || n.en || lead.contact_name || null,
    업종: lead.industry || null,
    상세업종: lead.industry_detail || null,
    사업내용: lead.business_desc || null,
  }
  const res = await openai().chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: pitch.temperature,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: pitch.system },
      { role: 'user', content: `이 회사에 보낼 메일을 작성하세요:\n${JSON.stringify(ctx, null, 2)}` },
    ],
  })
  const { subject, body } = JSON.parse(res.choices[0].message.content)
  return { subject: (subject || '').trim(), body: (body || '').trim() }
}
