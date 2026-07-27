import OpenAI from 'openai'

// 회사명으로 담당자(채용/마케팅) 이름·이메일을 웹서치로 찾는다(OpenAI Responses web_search).
// 반환: { email, contact_name, source, note } | null — 전부 '미검증' 취급(발송 전 사람이 확인).
let _o
const openai = () => (_o ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY }))

export async function findCompanyContact(brand, roleHint = '') {
  const r = await openai().responses.create({
    model: 'gpt-4o', // 웹서치는 mini보다 4o가 오탐 적음 (그래도 미검증 취급)
    tools: [{ type: 'web_search_preview' }],
    input: `"${brand}" 라는 회사의 담당자 컨택(이름·이메일)을 웹에서 최대한 찾아줘.${roleHint ? ` (이 회사는 ${roleHint} 같은 포지션을 채용 중입니다)` : ''}
찾을 것(우선순위 순, 찾은 건 다 보고):
1) 채용/HR 이메일(recruit·hr·career 등)
2) 없으면 비즈니스·마케팅·일반 문의 이메일(contact·info·biz·cs 등) — 공식 홈·contact 페이지·이용약관/환불정책 하단·채용공고 원문 등 실제 페이지에 적힌 주소면 뭐든 OK
3) 채용/인사/마케팅 책임자의 '이름' — 회사 디렉토리·기사·LinkedIn에 명시된 실제 인물이면 개인 이메일을 몰라도 이름만이라도 보고
금지: 이메일 패턴 추측·조합(예: 이름 이니셜로 j.doe@ 형식 만들기). 실제 페이지에 적힌 주소만.
동명 회사가 여럿이면, 마케팅·영상·디자인 인재를 채용하는 그 회사(한국 뷰티/이커머스 계열 가능성 높음)여야 함.
답변 마지막 줄에 반드시 아래 JSON 한 줄만 출력해줘(끝까지 못 찾은 필드만 null):
{"email": "...", "name": "...", "source": "출처 도메인/페이지"}`,
  })
  const text = r.output_text || ''
  // 마지막 JSON 라인 파싱 — 실패하면 본문 이메일 정규식 폴백
  let email = null, name = null, source = null
  const jm = text.match(/\{[^{}]*"email"[^{}]*\}/g)
  if (jm) {
    try {
      const j = JSON.parse(jm[jm.length - 1])
      email = j.email && /@/.test(j.email) ? j.email : null
      name = j.name || null
      source = j.source || null
    } catch { /* 폴백으로 */ }
  }
  if (!email) {
    // Gmail 등이 마스킹한 [email protected] 는 제외, 실제 주소만
    const m = text.match(/[\w.+-]+@[\w.-]+\.\w{2,}/)
    if (m) email = m[0]
  }
  if (!email && !name) return null
  return { email, contact_name: name, source, note: text.replace(/\s+/g, ' ').slice(0, 140) }
}
