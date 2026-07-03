import OpenAI from 'openai'

// 회사명으로 채용/비즈니스 문의 이메일을 웹서치로 찾는다(OpenAI Responses web_search). { email, note } | null
let _o
const openai = () => (_o ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY }))

export async function findCompanyEmail(brand, roleHint = '') {
  const r = await openai().responses.create({
    model: 'gpt-4o', // 웹서치는 mini보다 4o가 오탐 적음 (그래도 미검증 취급)
    tools: [{ type: 'web_search_preview' }],
    input: `"${brand}" 라는 회사의 채용/HR 또는 비즈니스·마케팅 문의 이메일 주소를 웹에서 찾아줘.${roleHint ? ` (이 회사는 ${roleHint} 같은 포지션을 채용 중입니다)` : ''}
- 회사 공식 홈페이지·채용페이지에 '명시된' 실제 주소만. 추측·조합 금지.
- 채용 전용(recruit·hr·career)이 우선, 없으면 비즈니스·일반 문의(contact·info·biz·marketing)도 좋음.
- 동명 회사가 여럿이면, 마케팅·영상·디자인 인재를 채용하는 그 회사여야 함.
찾으면 그 이메일 주소를 답변 본문에 그대로 적어줘(출처 도메인도 함께). 못 찾으면 "이메일 없음"이라고만.`,
  })
  const text = r.output_text || ''
  // Gmail 등이 마스킹한 [email protected] 는 제외, 실제 주소만
  const m = text.match(/[\w.+-]+@[\w.-]+\.\w{2,}/)
  if (!m) return null
  return { email: m[0], note: text.replace(/\s+/g, ' ').slice(0, 140) }
}
