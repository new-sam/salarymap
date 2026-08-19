// Dotdotdot(큐피스트) Content Marketer — 원본 CV 기반 gpt-4o-mini 1~5 채점.
// 기존 캠페인 채점(nx-designer 등)과 달리 파싱 요약이 아닌 **원본 CV 텍스트**로 채점한다
// — 파서가 성과 불릿을 버려서(정량 성과 기재 6/523명으로 과소집계) 요약만으론 실력 판별이 안 되기 때문.
// 게이트: 마케터 헤드라인 × 신호점수 4+ 또는 (3점 & 3y+), 기지원·기추천·수신거부 제외.
// 캐시 data/dotdotdot-cv-scores.json 키 "DDD:userId" — 멱등, 재실행 시 미채점분만 채점.
//
//   node scripts/outreach/dotdotdot-cv-score.mjs          # 채점(캐시 재사용) + 3점+ 명단
//   node scripts/outreach/dotdotdot-cv-score.mjs --list   # 채점 없이 캐시로 명단만
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { sb, fetchAll, openai } from './lib.mjs'
import { extractResumeText } from '../../lib/parseResume.js'

const JOB_ID = 'e9455954-ab65-4d31-b814-e7abdd6f4a6a' // Dotdotdot — Content Marketer (HCMC, 38–40M)
const CACHE_FILE = new URL('../../data/dotdotdot-cv-scores.json', import.meta.url)
const listOnly = process.argv.includes('--list')

// ── 게이트(산정 세션과 동일한 신호점수) ──
const hayOf = (p) => [
  ...(Array.isArray(p.skills) ? p.skills : []),
  p.position, p.headline, p.major,
  JSON.stringify(p.experiences || []),
  JSON.stringify(p.resume_summary || {}),
].map((s) => String(s || '').toLowerCase()).join(' | ')
const DEV_POS = ['fullstack', 'backend', 'frontend', 'devops', 'qa', 'mobile', 'ai/data', 'data', 'it', '개발', 'frontend developer', 'dev', 'developer']
const isDev = (p) => DEV_POS.includes(String(p.position || '').toLowerCase())
  || /\b(developer|engineer|programmer|lập trình)\b/i.test(String(p.headline || ''))
const isMarketer = (p) => /market|content|social|brand|pr\b|communication|truyền thông|copywrit|seo|growth|performance|digital/i.test(p.headline || '')
const SIG = {
  content: ['content', 'social media', 'tiktok', 'fanpage', 'copywrit', 'seo', 'viral', 'storytelling', 'kênh'],
  perf: ['performance', 'media buy', 'facebook ads', 'google ads', 'meta ads', 'tiktok ads', 'quảng cáo', 'roas', 'cpi', 'cpa', 'cpc', 'user acquisition', 'paid media', 'ads manager', 'digital marketing'],
  aiTools: ['midjourney', 'higgsfield', 'stable diffusion', 'runway', 'generative', 'chatgpt', 'gpt', 'ai content', 'dall-e', 'leonardo', 'kling', 'veo', 'sora'],
  prod: ['photoshop', 'premiere', 'after effects', 'illustrator', 'adobe', 'capcut', 'video edit', 'canva', 'figma', 'davinci'],
  domain: ['game', 'mobile app', 'app marketing', 'entertainment', 'webtoon', 'truyện', 'novel', 'chat app', 'dating', 'streaming', 'idol', 'fandom'],
}
const kwScore = (p) => {
  const hay = hayOf(p)
  const hits = Object.fromEntries(Object.entries(SIG).map(([k, kws]) => [k, kws.some((w) => hay.includes(w))]))
  let s = Object.values(hits).filter(Boolean).length
  if (hits.content && hits.perf) s += 1
  if (hits.aiTools) s += 1
  if ((p.yoe_months || 0) >= 36) s += 1
  return s
}

const RUBRIC = `이 후보를 Dotdotdot(글로벌 AI 컴패니언 챗 앱, 140개국 서비스)의 Content Marketer로 평가하라.
포지션은 호치민 근무, 콘텐츠 기획·제작부터 유료광고 성과까지 풀사이클을 혼자 담당하는 Growth Marketing 성격이다.
5 = 콘텐츠 제작(영상·이미지 포함)과 유료광고 운영(Meta/Google/TikTok 등)을 모두 실무로 했고, CV에 정량 성과(ROAS·CPI·CTR·팔로워·조회수·매출 등)가 구체적으로 적혀 있음
4 = 두 축 중 한 축이 강하고 다른 축도 실무 경험이 있으며 정량 성과가 일부 있음
3 = 콘텐츠 또는 퍼포먼스 한 축의 실무 경험이 2년 내외로 확실함(성과 서술이 약해도 됨) — 사전과제를 보낼 가치가 있는 수준
2 = 마케팅 직무지만 인턴·보조 수준이거나 단일 채널 운영 나열뿐
1 = 무관하거나 근거 부족
가점 +1(최대 5): 생성형 AI 제작툴(Midjourney·Kling·Veo·Runway 등) 실사용 / 앱·게임·엔터·웹툰·웹소설·팬덤 도메인 / 영어 콘텐츠 제작 경험`

async function cvText(p) {
  try {
    const res = await fetch(p.resume_url)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    const text = (await extractResumeText(buf) || '').trim()
    return text.length >= 200 ? text : null // 스캔본·빈 텍스트 → 프로필 폴백
  } catch { return null }
}

const profileText = (p) => {
  const exps = (Array.isArray(p.experiences) ? p.experiences : []).slice(0, 5)
    .map((e) => `${e.title || ''} @ ${e.company || ''} (${e.period || [e.start, e.end].filter(Boolean).join('~')}): ${String(e.description || '').slice(0, 200)}`)
  return `position: ${p.position || '?'}\nheadline: ${p.headline || '?'}\nskills: ${(p.skills || []).join(', ').slice(0, 300)}\n경력 ${p.yoe_months == null ? '?' : Math.round(p.yoe_months / 12 * 10) / 10}년\n경력사항: ${exps.join(' | ').slice(0, 800)}\n요약: ${JSON.stringify(p.resume_summary || {}).slice(0, 400)}`
}

async function main() {
  const [recs, apps, unsubs, pool] = await Promise.all([
    fetchAll(() => sb.from('job_recommendations').select('user_id,to_email').eq('job_id', JOB_ID).order('id')),
    fetchAll(() => sb.from('job_applications').select('user_id').eq('job_id', JOB_ID).order('id')),
    fetchAll(() => sb.from('events').select('user_id').eq('event', 'coldmail_unsub').not('user_id', 'is', null).order('id')),
    fetchAll(() => sb.from('user_profiles')
      .select('id,email,full_name,position,headline,skills,major,yoe_months,experiences,resume_summary,resume_url,is_resume_public,english_cert')
      .not('resume_url', 'is', null).order('id')),
  ])
  const excl = new Set([...recs, ...apps, ...unsubs].map((r) => r.user_id).filter(Boolean))
  const exclEmail = new Set(recs.map((r) => (r.to_email || '').toLowerCase()).filter(Boolean))

  const seen = new Set()
  const gated = pool.filter((p) => {
    const e = (p.email || '').toLowerCase()
    if (!e || /likelion/i.test(e) || seen.has(e)) return false
    seen.add(e)
    if (excl.has(p.id) || exclEmail.has(e)) return false
    if (isDev(p) || !isMarketer(p)) return false
    const s = kwScore(p)
    return s >= 4 || (s >= 3 && (p.yoe_months || 0) >= 36)
  })
  console.log(`게이트 통과: ${gated.length}명 (CV 풀 ${pool.length}명)`)

  const cache = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {}

  if (!listOnly) {
    const todo = gated.filter((p) => !cache[`DDD:${p.id}`])
    console.log(`채점 대상(캐시 미보유): ${todo.length}명`)
    let n = 0
    const CONC = 4
    for (let i = 0; i < todo.length; i += CONC) {
      await Promise.all(todo.slice(i, i + CONC).map(async (p) => {
        const text = await cvText(p)
        const src = text ? 'cv' : 'profile'
        const body = text ? text.slice(0, 6000) : profileText(p)
        const prompt = `${RUBRIC}\nJSON {"score": n, "why": "한 줄(한국어)"} 로만 답하라.\n\n${body}`
        try {
          const r = await openai.chat.completions.create({
            model: 'gpt-4o-mini', temperature: 0,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
          })
          const v = JSON.parse(r.choices[0].message.content)
          cache[`DDD:${p.id}`] = { score: v.score, why: v.why, src }
        } catch (e) { cache[`DDD:${p.id}`] = { score: 0, why: `error: ${String(e.message).slice(0, 60)}`, src } }
      }))
      n = Math.min(i + CONC, todo.length)
      writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 1))
      if (n % 20 < CONC) console.log(`  채점 ${n}/${todo.length}...`)
    }
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 1))
  }

  const scored = gated.map((p) => ({ p, ...(cache[`DDD:${p.id}`] || { score: 0, why: '미채점' }) }))
  const dist = {}
  for (const s of scored) dist[s.score] = (dist[s.score] || 0) + 1
  console.log(`점수 분포: ${JSON.stringify(dist)} (src=profile 폴백 ${scored.filter((s) => s.src === 'profile').length}명)`)

  const list = scored.filter((s) => s.score >= 3)
    .sort((a, b) => b.score - a.score || (b.p.yoe_months || 0) - (a.p.yoe_months || 0))
  console.log(`\n── 3점+ 명단: ${list.length}명 ──`)
  for (const { p, score, why, src } of list) {
    const y = Math.round((p.yoe_months || 0) / 12 * 10) / 10
    console.log(`[${score}${src === 'profile' ? '·요약폴백' : ''}·${p.is_resume_public ? '공개' : '비공개'}] ${p.full_name} <${p.email}> · ${y}y · ${String(p.headline || '').slice(0, 50)}`)
    console.log(`    ${why}`)
  }
}

main()
