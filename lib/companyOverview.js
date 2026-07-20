import OpenAI from 'openai'

// 회사 소개를 웹검색 + 공고 원문으로 근거를 잡아 생성한다(할루시네이션 방지).
// 배치 스크립트와(추후) 크론이 공유한다. 기본 언어는 베트남어(타겟 유저).
const LANG_NAME = { vi: 'tiếng Việt (Vietnamese)', en: 'English', ko: '한국어 (Korean)' }

const SYSTEM = (langName) => `You are an editor writing company overviews for FYI, a Vietnamese IT/jobs site.
Given a company name and a real job posting, use web search to find factual information about the company (what it does, industry, size, founding, HQ, notable products/clients/parent group). Then write an accurate overview in ${langName}.
Rules:
- Only state facts verifiable from search results or the provided posting. NEVER invent founding year, revenue, employee count, or clients.
- If reliable info is not found, describe conservatively based only on the posting, and omit what you don't know.
- No marketing clichés (e.g. "collaborative on-site environment"). Be specific and useful to a job seeker.
- 2-3 short paragraphs. First paragraph: what the company actually does.
- Output plain text only (no markdown headers, no bullet symbols).`

export async function generateCompanyOverview({ company, location, title, tech_stack, description, lang = 'vi', apiKey } = {}) {
  const client = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY })
  const desc = (description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 2500)
  const user = `Company: ${company}
Location: ${location || ''}
Sample role: ${title || ''}
Tech stack: ${(tech_stack || []).join(', ') || '-'}
Job posting text:
${desc || '(none)'}`

  const resp = await client.responses.create({
    model: 'gpt-4o',
    tools: [{ type: 'web_search_preview' }],
    input: [
      { role: 'system', content: SYSTEM(LANG_NAME[lang] || LANG_NAME.vi) },
      { role: 'user', content: user },
    ],
  })
  // web_search 툴이 본문에 끼워넣는 인용 마크다운(([domain](url)) / [label](url))을 제거 — plain text로.
  return (resp.output_text || '')
    .replace(/\s*\(\[[^\]]*\]\([^)]*\)\)/g, '')
    .replace(/\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/[ \t]+([.,;:])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
