import OpenAI from 'openai'

// 회사별 개인화 콜드메일 초안 생성 — 서버(API)·스크립트 공용 단일 소스.
let _openai
const openai = () => (_openai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY }))

// 코참 포맷 "ENGLISH ( 한글 )" → { en, ko }
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

// ── 우리 제안(피치) — 여기만 고치면 전체 카피가 바뀝니다 ─────────────────
const PRODUCT_PITCH = `
우리 서비스: salary-fyi(FYI) — 베트남 현지 인재 채용 플랫폼(앱+웹). 개발·IT가 강점이지만 웹·디자인·마케팅·무역/영업·사무 등 다양한 직무도 지원. ※ 정부지원 채용대행(KTC)과 별개.
- 채용공고 등록비 0원(무료). 공고를 올리면 보통 3일 안에 지원 CV가 모입니다.
- 베트남 IT 현직자가 남긴 '실연봉 데이터' 기반이라 시장가가 투명하고 지원자 질이 높습니다.
- 지원자 관리(상태·이력서·인터뷰 일정)는 FYI ATS 한 화면에서.
- 성과형 과금: 선결제·게재비 없이, 채용이 확정·유지될 때만 연봉의 7% (3개월 미유지 시 0원). 헤드헌팅(15~25%)보다 저렴.
핵심 CTA: "무료로 채용공고를 올려보시고 3일 안에 지원 CV를 받아보세요." 지금 채용계획이 없어도 '요즘 베트남 IT 인재시장이 어떤지' 가볍게 답장 주셔도 좋다는 톤.
`.trim()

// 서명·수신거부는 발송 시점에 붙는다 (내 Gmail 설정 서명 사용). senderName = 발신자(위승주/남영훈).
const buildSystem = (senderName) => `당신은 베트남에 진출한 한국기업을 상대하는 B2B 세일즈 담당자입니다.
아래 "우리 제안"을 바탕으로, 특정 회사에 보낼 콜드 영업 이메일 한 통을 작성하세요.

[우리 제안]
${PRODUCT_PITCH}

[작성 규칙]
- 한국어 존댓말. 플레인텍스트(마크다운/HTML/이모지 금지).
- 읽기 쉽게 줄바꿈: 한 문장(또는 짧은 의미 단위)마다 줄바꿈(\\n)을 넣고, 인사·본론·제안·맺음 블록 사이엔 빈 줄(\\n\\n). 여러 문장을 한 줄에 붙이지 말 것.
- 인사 다음, 그 회사의 사업내용·업종을 구체적으로 언급해 "당신 회사를 알고 보냈다"는 느낌을 줄 것. 과장/아부 금지.
- 그 회사가 필요로 할 만한 직무(사업내용에서 유추 — 개발·웹·디자인·마케팅·무역/영업·사무 등)와 자연스럽게 연결. 특정 직무를 단정하지 말고 "귀사에 맞는 직무의 베트남 인재"처럼 유연하게.
- 전체 4~6문장, 짧게. 한 가지 CTA만. 스팸성 표현 금지, 담백하게.
- 본문은 반드시 아래처럼 "세 줄"로 시작 (각 문장 줄바꿈):
안녕하세요, {담당자} 대표님.
Likelion(멋쟁이사자처럼)의 ${senderName}입니다.
처음 인사드립니다.
  (담당자 이름을 모르면 첫 줄을 "안녕하세요, 담당자님." 으로. 반드시 세 줄.)
- 끝맺음은 반드시 "감사합니다." 줄바꿈 후 "${senderName} 드림" 으로 끝낼 것.
- ⚠️ 연락처·전화·이메일·회사주소 등 서명 정보와 수신거부 문구는 절대 쓰지 말 것 (Gmail 서명이 자동으로 붙습니다).
- 제목은 회사명이나 업종을 살짝 녹여 개인화하되 30자 이내, 낚시성 금지.

반드시 JSON 으로만 응답: {"subject": "...", "body": "..."}`

export async function generateDraft(lead, senderName = '위승주') {
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
    temperature: 0.7,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: buildSystem(senderName) },
      { role: 'user', content: `이 회사에 보낼 메일을 작성하세요:\n${JSON.stringify(ctx, null, 2)}` },
    ],
  })
  const { subject, body } = JSON.parse(res.choices[0].message.content)
  return { subject: (subject || '').trim(), body: (body || '').trim() }
}
