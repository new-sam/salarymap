// 전체 크롤링 실행
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const WANTED_API = 'https://www.wanted.co.kr/api/v4/jobs'
const PAGE_LIMIT = 20
const MAX_PAGES = 10

const TECH_KEYWORDS = [
  'React', 'Vue', 'Angular', 'Next.js', 'Node.js', 'Express',
  'TypeScript', 'JavaScript', 'Python', 'Java', 'Kotlin', 'Go', 'Rust',
  'Spring', 'Django', 'FastAPI', 'NestJS',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis',
  'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes',
  'Git', 'GraphQL', 'Flutter', 'React Native', 'Swift',
]

const CITY_MAP = {
  '서울': 'Seoul', '부산': 'Busan', '인천': 'Incheon', '대구': 'Daegu',
  '대전': 'Daejeon', '광주': 'Gwangju', '울산': 'Ulsan', '세종': 'Sejong',
  '수원': 'Suwon', '성남': 'Seongnam', '판교': 'Pangyo', '제주': 'Jeju',
  '강남': 'Seoul', '역삼': 'Seoul', '중구': 'Seoul', '마포': 'Seoul',
  '강원': 'Gangwon', '원주': 'Wonju',
}

const TITLE_MAP = [
  [/백엔드|서버\s*개발/i, 'Backend Developer'],
  [/프론트엔드|프론트\s*개발/i, 'Frontend Developer'],
  [/풀스택/i, 'Fullstack Developer'],
  [/데이터\s*엔지니어/i, 'Data Engineer'],
  [/데이터\s*분석/i, 'Data Analyst'],
  [/데이터\s*사이언/i, 'Data Scientist'],
  [/머신러닝|ML\s*엔지니어/i, 'ML Engineer'],
  [/AI\s*엔지니어|인공지능/i, 'AI Engineer'],
  [/모바일|앱\s*개발/i, 'Mobile Developer'],
  [/iOS\s*개발/i, 'iOS Developer'],
  [/안드로이드|Android\s*개발/i, 'Android Developer'],
  [/DevOps|데브옵스/i, 'DevOps Engineer'],
  [/인프라/i, 'Infrastructure Engineer'],
  [/클라우드/i, 'Cloud Engineer'],
  [/SRE/i, 'SRE'],
  [/보안|시큐리티/i, 'Security Engineer'],
  [/QA|테스트/i, 'QA Engineer'],
  [/기획|PM|프로덕트\s*매니저/i, 'Product Manager'],
  [/디자이너|UX|UI/i, 'Designer'],
]

function simplifyLocation(address) {
  const full = address?.full_location || address?.location || ''
  for (const [kr, en] of Object.entries(CITY_MAP)) {
    if (full.includes(kr)) return en
  }
  const loc = address?.location || ''
  for (const [kr, en] of Object.entries(CITY_MAP)) {
    if (loc.includes(kr)) return en
  }
  return 'Seoul'
}

function translateTitle(korTitle) {
  if (/^[a-zA-Z\s\[\]\(\)\-\/,\.&]+$/.test(korTitle)) return korTitle
  for (const [pattern, eng] of TITLE_MAP) {
    if (pattern.test(korTitle)) {
      let prefix = ''
      if (/시니어|Senior/i.test(korTitle)) prefix = 'Senior '
      else if (/주니어|Junior/i.test(korTitle)) prefix = 'Junior '
      return prefix + eng
    }
  }
  return korTitle
}

function guessRole(title, techStack) {
  const t = (title || '').toLowerCase()
  if (t.includes('frontend') || t.includes('프론트')) return 'Frontend'
  if (t.includes('backend') || t.includes('백엔드') || t.includes('서버')) return 'Backend'
  if (t.includes('fullstack') || t.includes('풀스택')) return 'Fullstack'
  if (t.includes('mobile') || t.includes('ios') || t.includes('android') || t.includes('앱')) return 'Mobile'
  if (t.includes('data') || t.includes('데이터') || t.includes('ml') || t.includes('ai')) return 'Data'
  if (t.includes('devops') || t.includes('sre') || t.includes('인프라')) return 'DevOps'
  if (t.includes('pm') || t.includes('기획') || t.includes('product')) return 'PM'
  if (t.includes('design') || t.includes('디자인')) return 'Design'
  if (t.includes('qa') || t.includes('테스트')) return 'QA'
  return 'Backend'
}

function extractTech(text) {
  if (!text) return []
  return TECH_KEYWORDS.filter(tech => text.toLowerCase().includes(tech.toLowerCase()))
}

function buildDescription(detail) {
  const d = detail.detail || {}
  const parts = []
  if (d.intro) parts.push(d.intro)
  if (d.main_tasks) parts.push('[주요업무]\n' + d.main_tasks)
  if (d.requirements) parts.push('[자격요건]\n' + d.requirements)
  if (d.preferred) parts.push('[우대사항]\n' + d.preferred)
  return parts.join('\n\n')
}

async function main() {
  console.log('=== 전체 크롤링 시작 ===\n')

  let allJobs = []
  let offset = 0

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = WANTED_API + '?country=kr&tag_type_ids=518&location=all&years=-1&limit=' + PAGE_LIMIT + '&offset=' + offset
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!resp.ok) { console.log('Fetch failed at page', page); break }

    const data = await resp.json()
    const jobs = data.data || []
    if (jobs.length === 0) break

    allJobs = allJobs.concat(jobs)
    offset += PAGE_LIMIT
    console.log('Page ' + (page + 1) + ': +' + jobs.length + ' (total: ' + allJobs.length + ')')

    if (!data.links?.next) break
    await sleep(500)
  }

  console.log('\nTotal fetched: ' + allJobs.length)

  // 기존 중복 체크
  const { data: existing } = await supabase.from('jobs').select('source_id').eq('source', 'wanted')
  const existingIds = new Set((existing || []).map(j => j.source_id))
  const newJobs = allJobs.filter(j => !existingIds.has(String(j.id)))
  console.log('New (not duplicate): ' + newJobs.length + '\n')

  let inserted = 0
  let failed = 0

  for (let i = 0; i < newJobs.length; i++) {
    const listItem = newJobs[i]
    try {
      const detailResp = await fetch(WANTED_API + '/' + listItem.id, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (!detailResp.ok) { failed++; continue }
      const detail = (await detailResp.json()).job
      if (!detail) { failed++; continue }

      const skillTags = (detail.skill_tags || []).map(s => s.title).filter(Boolean)
      const techStack = skillTags.length > 0 ? skillTags : extractTech(detail.detail?.requirements || '')
      const benefits = detail.detail?.benefits
        ? detail.detail.benefits.split('\n').map(s => s.replace(/^[•\-\s]+/, '').trim()).filter(s => s.length > 0 && s.length < 100).slice(0, 10)
        : []

      const originalTitle = detail.position || listItem.position
      const record = {
        title: translateTitle(originalTitle),
        company: detail.company?.name || '',
        company_initials: (detail.company?.name || '').slice(0, 2).toUpperCase(),
        location: simplifyLocation(detail.address || listItem.address),
        type: 'remote',
        country: 'korea',
        role: guessRole(originalTitle, techStack),
        experience_min: detail.annual_from || 0,
        experience_max: detail.annual_to || 0,
        salary_min: 0,
        salary_max: 0,
        description: buildDescription(detail),
        is_active: true,
        image_url: listItem.title_img?.origin || null,
        logo_url: listItem.logo_img?.origin || null,
        tech_stack: techStack,
        benefits,
        deadline: listItem.due_time || null,
        apply_url: 'https://www.wanted.co.kr/wd/' + listItem.id,
        source: 'wanted',
        source_id: String(listItem.id),
      }

      const { error } = await supabase.from('jobs').insert(record)
      if (error) {
        console.log('  ERR [' + (i+1) + '] ' + originalTitle + ': ' + error.message)
        failed++
      } else {
        inserted++
        if (inserted % 10 === 0) console.log('  Inserted: ' + inserted + '/' + newJobs.length)
      }

      await sleep(300)
    } catch (err) {
      console.log('  ERR [' + (i+1) + '] ' + err.message)
      failed++
    }
  }

  console.log('\n=== 완료 ===')
  console.log('Inserted: ' + inserted)
  console.log('Failed: ' + failed)
  console.log('Skipped (dup): ' + (allJobs.length - newJobs.length))
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

main().catch(console.error)
