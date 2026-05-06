import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const WANTED_API = 'https://www.wanted.co.kr/api/v4/jobs'
const WANTED_DETAIL_API = 'https://www.wanted.co.kr/api/v4/jobs'
const PAGE_LIMIT = 20
const MAX_PAGES = 10 // 최대 200개

// 기술스택 키워드 매칭용
const TECH_KEYWORDS = [
  'React', 'Vue', 'Angular', 'Next.js', 'Node.js', 'Express',
  'TypeScript', 'JavaScript', 'Python', 'Java', 'Kotlin', 'Go', 'Rust', 'C++',
  'Spring', 'Django', 'FastAPI', 'NestJS', 'Rails',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch',
  'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Terraform',
  'Git', 'CI/CD', 'GraphQL', 'REST',
  'Flutter', 'React Native', 'Swift', 'iOS', 'Android',
]

export default async function handler(req, res) {
  // Vercel Cron 인증
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const result = await crawlWantedRemoteJobs()
    return res.status(200).json(result)
  } catch (err) {
    console.error('Crawl error:', err)
    return res.status(500).json({ error: err.message })
  }
}

async function crawlWantedRemoteJobs() {
  let allJobs = []
  let offset = 0

  // 페이지네이션으로 원격근무 공고 수집
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${WANTED_API}?country=kr&tag_type_ids=518&location=all&years=-1&limit=${PAGE_LIMIT}&offset=${offset}`
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    if (!resp.ok) break

    const data = await resp.json()
    const jobs = data.data || []
    if (jobs.length === 0) break

    allJobs = allJobs.concat(jobs)
    offset += PAGE_LIMIT

    if (!data.links?.next) break
    // rate limit 방지
    await sleep(500)
  }

  // 기존 source_id 조회 (중복 방지)
  const { data: existing } = await supabase
    .from('jobs')
    .select('source_id')
    .eq('source', 'wanted')

  const existingIds = new Set((existing || []).map(j => j.source_id))

  // 신규 공고만 필터
  const newJobs = allJobs.filter(j => !existingIds.has(String(j.id)))

  // 상세 정보 가져와서 저장
  let inserted = 0
  for (const job of newJobs) {
    try {
      const detail = await fetchJobDetail(job.id)
      if (!detail) continue

      const record = mapToRecord(job, detail)
      const { error } = await supabase.from('jobs').insert(record)
      if (!error) inserted++

      await sleep(300)
    } catch (err) {
      console.error(`Failed job ${job.id}:`, err.message)
    }
  }

  // 마감일 지난 공고 비활성 처리
  const deactivated = await deactivateExpired()

  return {
    total_fetched: allJobs.length,
    new_inserted: inserted,
    skipped_duplicates: allJobs.length - newJobs.length,
    deactivated,
  }
}

async function fetchJobDetail(jobId) {
  const resp = await fetch(`${WANTED_DETAIL_API}/${jobId}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  })
  if (!resp.ok) return null
  const data = await resp.json()
  return data.job || null
}

// 한국 도시명 → 영문 매핑
const CITY_MAP = {
  '서울': 'Seoul', '부산': 'Busan', '인천': 'Incheon', '대구': 'Daegu',
  '대전': 'Daejeon', '광주': 'Gwangju', '울산': 'Ulsan', '세종': 'Sejong',
  '수원': 'Suwon', '성남': 'Seongnam', '판교': 'Pangyo', '제주': 'Jeju',
  '강남': 'Seoul', '역삼': 'Seoul', '중구': 'Seoul', '마포': 'Seoul',
  '강원': 'Gangwon', '원주': 'Wonju',
}

// 한국어 직무명 → 영문 변환
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
  [/CTO/i, 'CTO'],
  [/리드|팀\s*리더|테크\s*리드/i, 'Tech Lead'],
  [/시니어/i, 'Senior'],
  [/주니어/i, 'Junior'],
]

function simplifyLocation(address) {
  const full = address?.full_location || address?.location || ''
  for (const [kr, en] of Object.entries(CITY_MAP)) {
    if (full.includes(kr)) return en
  }
  // fallback: use location field
  const loc = address?.location || ''
  for (const [kr, en] of Object.entries(CITY_MAP)) {
    if (loc.includes(kr)) return en
  }
  return 'Seoul'
}

function translateTitle(korTitle) {
  // 이미 영어면 그대로
  if (/^[a-zA-Z\s\[\]\(\)\-\/,\.&]+$/.test(korTitle)) return korTitle

  // 매핑 시도
  for (const [pattern, eng] of TITLE_MAP) {
    if (pattern.test(korTitle)) {
      // 시니어/주니어/리드 prefix 처리
      let prefix = ''
      if (/시니어|Senior/i.test(korTitle)) prefix = 'Senior '
      else if (/주니어|Junior/i.test(korTitle)) prefix = 'Junior '
      else if (/리드|Lead/i.test(korTitle)) prefix = 'Lead '

      const base = eng.startsWith('Senior') || eng.startsWith('Junior') || eng.startsWith('Tech Lead') ? eng : prefix + eng
      return base
    }
  }

  // 매핑 실패시 원문 유지
  return korTitle
}

function mapToRecord(listItem, detail) {
  const skillTags = (detail.skill_tags || []).map(s => s.title).filter(Boolean)
  const techStack = skillTags.length > 0
    ? skillTags
    : extractTechFromText(detail.detail?.requirements || '')

  const benefits = detail.detail?.benefits
    ? detail.detail.benefits.split('\n').map(s => s.replace(/^[•\-\s]+/, '').trim()).filter(s => s.length > 0 && s.length < 100).slice(0, 10)
    : []

  const originalTitle = detail.position || listItem.position
  const englishTitle = translateTitle(originalTitle)

  return {
    title: englishTitle,
    company: detail.company?.name || listItem.company?.name || '',
    company_initials: (detail.company?.name || '').slice(0, 2).toUpperCase(),
    location: simplifyLocation(detail.address || listItem.address),
    type: 'remote',
    country: 'korea',
    role: guessRole(originalTitle, techStack),
    experience_min: detail.annual_from || listItem.annual_from || 0,
    experience_max: detail.annual_to || listItem.annual_to || 0,
    salary_min: 0,
    salary_max: 0,
    description: buildDescription(detail),
    is_active: true,
    image_url: listItem.title_img?.origin || null,
    logo_url: listItem.logo_img?.origin || null,
    tech_stack: techStack,
    benefits,
    hiring_process: null,
    deadline: listItem.due_time || null,
    apply_url: `https://www.wanted.co.kr/wd/${listItem.id}`,
    source: 'wanted',
    source_id: String(listItem.id),
  }
}

function buildDescription(detail) {
  const d = detail.detail || {}
  const parts = []
  if (d.intro) parts.push(d.intro)
  if (d.main_tasks) parts.push(`[주요업무]\n${d.main_tasks}`)
  if (d.requirements) parts.push(`[자격요건]\n${d.requirements}`)
  if (d.preferred) parts.push(`[우대사항]\n${d.preferred}`)
  return parts.join('\n\n')
}

function extractTechFromText(text) {
  if (!text) return []
  return TECH_KEYWORDS.filter(tech =>
    text.toLowerCase().includes(tech.toLowerCase())
  )
}

function guessRole(title, techStack) {
  const t = (title || '').toLowerCase()
  const stack = techStack.join(' ').toLowerCase()
  if (t.includes('frontend') || t.includes('프론트') || stack.includes('react') && !stack.includes('node')) return 'Frontend'
  if (t.includes('backend') || t.includes('백엔드') || t.includes('서버')) return 'Backend'
  if (t.includes('fullstack') || t.includes('풀스택')) return 'Fullstack'
  if (t.includes('mobile') || t.includes('ios') || t.includes('android') || t.includes('앱')) return 'Mobile'
  if (t.includes('data') || t.includes('데이터') || t.includes('ml') || t.includes('ai')) return 'Data'
  if (t.includes('devops') || t.includes('sre') || t.includes('인프라') || t.includes('클라우드')) return 'DevOps'
  if (t.includes('pm') || t.includes('기획') || t.includes('product')) return 'PM'
  if (t.includes('design') || t.includes('디자인') || t.includes('ux')) return 'Design'
  if (t.includes('qa') || t.includes('테스트') || t.includes('test')) return 'QA'
  return 'Backend'
}

async function deactivateExpired() {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('jobs')
    .update({ is_active: false })
    .eq('is_active', true)
    .not('deadline', 'is', null)
    .lt('deadline', today)
    .select('id')

  return data?.length || 0
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
