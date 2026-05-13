import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TOPDEV_API = 'https://api.topdev.vn/td/v2/jobs'
const PAGE_LIMIT = 20
const MAX_PAGES = 15 // 최대 300개

const TECH_KEYWORDS = [
  'React', 'Vue', 'Angular', 'Next.js', 'Node.js', 'Express',
  'TypeScript', 'JavaScript', 'Python', 'Java', 'Kotlin', 'Go', 'Rust', 'C++',
  'Spring', 'Django', 'FastAPI', 'NestJS', 'Rails',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch',
  'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Terraform',
  'Git', 'CI/CD', 'GraphQL', 'REST',
  'Flutter', 'React Native', 'Swift', 'iOS', 'Android',
  'PyTorch', 'TensorFlow', 'Spark', 'Kafka',
  'PHP', 'Laravel', '.NET', 'C#', 'Ruby',
]

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const result = await crawlTopDev()
    return res.status(200).json(result)
  } catch (err) {
    console.error('TopDev crawl error:', err)
    return res.status(500).json({ error: err.message })
  }
}

async function crawlTopDev() {
  let allJobs = []

  for (let page = 1; page <= MAX_PAGES; page++) {
    const fields = 'id,slug,title,salary,company,skills_str,addresses,status_display,responsibilities_original,requirements_original,benefits_original'
    const url = `${TOPDEV_API}?fields[job]=${fields}&locale=en&page=${page}&limit=${PAGE_LIMIT}`

    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    if (!resp.ok) break

    const data = await resp.json()
    const jobs = data.data || []
    if (jobs.length === 0) break

    allJobs = allJobs.concat(jobs)
    await sleep(500)
  }

  // 기존 source_id 조회 (중복 방지)
  const { data: existing } = await supabase
    .from('jobs')
    .select('source_id')
    .eq('source', 'topdev')

  const existingIds = new Set((existing || []).map(j => j.source_id))

  // non-tech 공고 제외 + 신규만 필터
  const newJobs = allJobs
    .filter(j => !existingIds.has(String(j.id)))
    .filter(j => !isNonTechJob(j))

  let inserted = 0
  for (const job of newJobs) {
    try {
      const record = mapToRecord(job)
      const { error } = await supabase.from('jobs').insert(record)
      if (!error) inserted++
    } catch (err) {
      console.error(`Failed topdev job ${job.id}:`, err.message)
    }
  }

  return {
    total_fetched: allJobs.length,
    new_inserted: inserted,
    skipped_duplicates: allJobs.length - newJobs.length,
  }
}

function mapToRecord(job) {
  const company = job.company || {}
  const salary = job.salary || {}
  const skills = (job.skills_str || '').split(',').map(s => s.trim()).filter(Boolean)
  const techStack = skills.length > 0 ? skills : extractTechFromText(job.requirements_original || '')

  const benefitsHtml = (job.benefits_original || []).map(b => b.value || '').join('\n')
  const benefits = stripHtml(benefitsHtml)
    .split('\n')
    .map(s => s.replace(/^[•\-\s]+/, '').trim())
    .filter(s => s.length > 0 && s.length < 150)
    .slice(0, 10)

  const description = buildDescription(job)
  const location = simplifyLocation(job.addresses)
  const country = guessCountry(job.addresses)

  return {
    title: job.title || '',
    company: company.display_name || '',
    company_initials: (company.display_name || '').slice(0, 2).toUpperCase(),
    logo_url: company.image_logo || null,
    location,
    type: 'onsite',
    country,
    role: guessRole(job.title, techStack),
    experience_min: 0,
    experience_max: 0,
    salary_min: salary.min_filter || 0,
    salary_max: salary.max_filter || 0,
    description,
    is_active: true,
    tech_stack: techStack,
    benefits,
    apply_url: `https://topdev.vn/detail-jobs/${job.slug}`,
    source: 'topdev',
    source_id: String(job.id),
    company_url: company.detail_url || null,
  }
}

function buildDescription(job) {
  const parts = []
  if (job.responsibilities_original) parts.push(`[Responsibilities]\n${stripHtml(job.responsibilities_original)}`)
  if (job.requirements_original) parts.push(`[Requirements]\n${stripHtml(job.requirements_original)}`)
  return parts.join('\n\n')
}

function stripHtml(html) {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function extractTechFromText(text) {
  if (!text) return []
  const plain = stripHtml(text)
  return TECH_KEYWORDS.filter(tech =>
    plain.toLowerCase().includes(tech.toLowerCase())
  )
}

const PROVINCE_MAP = {
  'Thành phố Hồ Chí Minh': 'Ho Chi Minh City',
  'Thành phố Hà Nội': 'Hanoi',
  'Thành phố Đà Nẵng': 'Da Nang',
  'Hồ Chí Minh': 'Ho Chi Minh City',
  'Hà Nội': 'Hanoi',
  'Đà Nẵng': 'Da Nang',
  'Oversea': 'Overseas',
}

function simplifyLocation(addresses) {
  if (!addresses) return ''
  const regions = addresses.address_region_array || []
  for (const region of regions) {
    if (PROVINCE_MAP[region]) return PROVINCE_MAP[region]
  }
  if (addresses.sort_addresses) {
    for (const [vn, en] of Object.entries(PROVINCE_MAP)) {
      if (addresses.sort_addresses.includes(vn)) return en
    }
  }
  return regions[0] || ''
}

function guessCountry(addresses) {
  if (!addresses) return 'vietnam'
  const regions = addresses.address_region_array || []
  if (regions.includes('Oversea')) return 'global'
  return 'vietnam'
}

function guessRole(title, techStack) {
  const t = (title || '').toLowerCase()
  const stack = techStack.join(' ').toLowerCase()
  if (t.includes('frontend') || t.includes('front-end') || t.includes('front end')) return 'Frontend'
  if (t.includes('backend') || t.includes('back-end') || t.includes('back end') || t.includes('server')) return 'Backend'
  if (t.includes('fullstack') || t.includes('full-stack') || t.includes('full stack')) return 'Fullstack'
  if (t.includes('mobile') || t.includes('ios') || t.includes('android')) return 'Mobile'
  if (t.includes('data') || t.includes('machine learning') || t.includes('ml') || t.includes('ai ')) return 'Data'
  if (t.includes('devops') || t.includes('sre') || t.includes('infrastructure') || t.includes('platform')) return 'DevOps'
  if (t.includes('product manager') || t.includes('program manager')) return 'PM'
  if (t.includes('design') || t.includes('ux') || t.includes('ui')) return 'Design'
  if (t.includes('qa') || t.includes('quality') || t.includes('test') || t.includes('tester')) return 'QA'
  if (t.includes('php') || t.includes('laravel') || t.includes('magento') || stack.includes('php')) return 'Backend'
  if (t.includes('.net') || t.includes('c#') || stack.includes('.net')) return 'Backend'
  if (t.includes('java') && !t.includes('javascript')) return 'Backend'
  return 'Backend'
}

const NON_TECH_KEYWORDS = [
  'accountant', 'accounting', 'kế toán', 'kiểm toán',
  'sales', 'kinh doanh', 'bán hàng',
  'logistics', 'vận chuyển', 'giao nhận',
  'marketing', 'truyền thông',
  'nhân sự', 'human resource', 'tuyển dụng', 'recruitment',
  'legal', 'pháp lý', 'luật',
  'hành chính', 'lễ tân', 'receptionist',
  'thư ký', 'secretary',
  'content writer', 'biên tập',
  'dược', 'y tá', 'bác sĩ', 'pharmacist', 'nurse',
]

function isNonTechJob(job) {
  const title = (job.title || '').toLowerCase()
  const skills = (job.skills_str || '').toLowerCase()
  const combined = title + ' ' + skills

  // title에 non-tech 키워드가 있고, tech 키워드가 전혀 없으면 제외
  const hasNonTech = NON_TECH_KEYWORDS.some(kw => combined.includes(kw))
  if (!hasNonTech) return false

  const hasTech = TECH_KEYWORDS.some(kw => combined.toLowerCase().includes(kw.toLowerCase()))
  return !hasTech
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
