import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TECH_KEYWORDS = [
  'React', 'Vue', 'Angular', 'Next.js', 'Node.js', 'Express',
  'TypeScript', 'JavaScript', 'Python', 'Java', 'Kotlin', 'Go', 'Rust', 'C++',
  'Spring', 'Django', 'FastAPI', 'NestJS', 'Rails',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch',
  'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Terraform',
  'Git', 'CI/CD', 'GraphQL', 'REST',
  'Flutter', 'React Native', 'Swift', 'iOS', 'Android',
  'PyTorch', 'TensorFlow', 'Spark', 'Kafka',
]

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const result = await crawlAllTargets()
    return res.status(200).json(result)
  } catch (err) {
    console.error('Crawl error:', err)
    return res.status(500).json({ error: err.message })
  }
}

async function crawlAllTargets() {
  const { data: targets } = await supabase
    .from('crawl_targets')
    .select('*')
    .eq('is_active', true)

  if (!targets?.length) return { message: 'No active targets' }

  const results = []

  for (const target of targets) {
    try {
      let jobs = []
      if (target.source_type === 'greenhouse') {
        jobs = await fetchGreenhouse(target.slug)
      } else if (target.source_type === 'lever') {
        jobs = await fetchLever(target.slug)
      } else if (target.source_type === 'workable') {
        jobs = await fetchWorkable(target.slug)
      } else if (target.source_type === 'greetinghr') {
        jobs = await fetchGreetingHR(target.career_url)
      }

      const inserted = await saveJobs(jobs, target)

      await supabase
        .from('crawl_targets')
        .update({ last_crawled_at: new Date().toISOString() })
        .eq('id', target.id)

      results.push({
        company: target.company_name,
        source: target.source_type,
        fetched: jobs.length,
        inserted,
      })

      await sleep(500)
    } catch (err) {
      results.push({
        company: target.company_name,
        error: err.message,
      })
    }
  }

  // Deactivate expired jobs
  const deactivated = await deactivateExpired()

  return { results, deactivated }
}

async function fetchGreenhouse(slug) {
  const resp = await fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`)
  if (!resp.ok) return []
  const data = await resp.json()
  const jobs = data.jobs || []

  const detailed = []
  for (const job of jobs) {
    const detailResp = await fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs/${job.id}`)
    if (!detailResp.ok) continue
    const detail = await detailResp.json()
    detailed.push(detail)
    await sleep(200)
  }

  return detailed.map(j => ({
    title: j.title,
    location: j.location?.name || '',
    content: j.content || '',
    url: j.absolute_url,
    source_id: String(j.id),
    source_type: 'greenhouse',
    departments: (j.departments || []).map(d => d.name).join(', '),
    updated_at: j.updated_at,
  }))
}

async function fetchLever(slug) {
  const resp = await fetch(`https://api.lever.co/v0/postings/${slug}`)
  if (!resp.ok) return []
  const data = await resp.json()
  if (!Array.isArray(data)) return []

  return data.map(j => ({
    title: j.text,
    location: j.categories?.location || '',
    content: (j.descriptionPlain || '') + '\n' + (j.lists || []).map(l => l.text + '\n' + l.content).join('\n'),
    url: j.hostedUrl,
    source_id: j.id,
    source_type: 'lever',
    departments: j.categories?.team || j.categories?.department || '',
    workplace_type: j.workplaceType || '',
    updated_at: j.createdAt ? new Date(j.createdAt).toISOString() : null,
  }))
}

async function fetchWorkable(slug) {
  const resp = await fetch(`https://apply.workable.com/api/v1/widget/accounts/${slug}?details=true`)
  if (!resp.ok) return []
  const data = await resp.json()
  const jobs = data.jobs || []

  return jobs.map(j => ({
    title: j.title,
    location: j.location || '',
    content: j.description || '',
    url: j.url || `https://apply.workable.com/${slug}/j/${j.shortcode}/`,
    source_id: j.shortcode || j.id,
    source_type: 'workable',
    departments: j.department || '',
    workplace_type: '',
  }))
}

async function fetchGreetingHR(careerUrl) {
  if (!careerUrl) return []
  const resp = await fetch(careerUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' } })
  if (!resp.ok) return []
  const html = await resp.text()

  // Extract __NEXT_DATA__ JSON
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/)
  if (!match) return []

  const data = JSON.parse(match[1])
  const pageProps = data.props?.pageProps || {}

  // Pattern: VNG
  if (Array.isArray(pageProps.jobs) && pageProps.jobs[0]?.job_id) {
    return pageProps.jobs.map(j => ({
      title: j.title,
      location: j.location || '',
      content: j.description || j.summary || '',
      url: `https://career.vng.com.vn/co-hoi-nghe-nghiep/${j.slug}`,
      source_id: String(j.job_id || j.code),
      source_type: 'greetinghr',
      departments: j.job_family || '',
    }))
  }

  // Pattern: MoMo (find array with jobId)
  const findMomoJobs = (obj) => {
    if (!obj || typeof obj !== 'object') return null
    if (Array.isArray(obj) && obj.length > 0 && obj[0].jobId) return obj
    for (const val of Object.values(obj)) {
      const found = findMomoJobs(val)
      if (found) return found
    }
    return null
  }
  const momoJobs = findMomoJobs(pageProps)
  if (momoJobs) {
    return momoJobs.map(j => ({
      title: j.jobTitle || j.title || '',
      location: j.location || '',
      content: '',
      url: j.subdirectory ? `https://momo.careers/${j.subdirectory}` : '',
      source_id: String(j.jobId || j.jobCode),
      source_type: 'greetinghr',
      departments: '',
    }))
  }

  // Pattern 1: openData (직방 style)
  const openData = pageProps.openData
  if (openData && Array.isArray(openData)) {
    return openData.map(j => ({
      title: j.title,
      location: j.detailPlace || '',
      content: '',
      url: `https://${j.url}`,
      source_id: String(j.id),
      source_type: 'greetinghr',
      departments: j.job || '',
      workplace_type: j.workFromHome ? 'remote' : '',
    }))
  }

  // Pattern 2: dehydratedState (Upstage style)
  const queries = pageProps.dehydratedState?.queries || []
  for (const q of queries) {
    const qData = q.state?.data
    if (Array.isArray(qData) && qData.length > 0 && qData[0].openingId) {
      return qData.map(j => {
        const pos = j.openingJobPosition?.openingJobPositions?.[0]
        const place = pos?.workspacePlace
        return {
          title: j.title,
          location: place?.place || place?.location || '',
          content: '',
          url: '',
          source_id: String(j.openingId),
          source_type: 'greetinghr',
          departments: pos?.workspaceOccupation?.occupation || '',
          workplace_type: place?.workFromHome ? 'remote' : '',
        }
      })
    }
  }

  return []
}

async function saveJobs(jobs, target) {
  if (!jobs.length) return 0

  const { data: existing } = await supabase
    .from('jobs')
    .select('source_id')
    .eq('source', target.source_type)

  const existingIds = new Set((existing || []).map(j => j.source_id))

  let inserted = 0
  for (const job of jobs) {
    if (existingIds.has(job.source_id)) continue

    const techStack = extractTech(job.content)
    const type = guessType(job.location, job.workplace_type)
    const role = guessRole(job.title, techStack)

    const record = {
      title: job.title,
      company: target.company_name,
      company_initials: target.company_name.slice(0, 2).toUpperCase(),
      location: simplifyLocation(job.location),
      type,
      country: guessCountry(job.location),
      role,
      experience_min: 0,
      experience_max: 0,
      salary_min: 0,
      salary_max: 0,
      description: stripHtml(job.content),
      is_active: true,
      tech_stack: techStack,
      apply_url: job.url,
      source: target.source_type,
      source_id: job.source_id,
      company_url: target.career_url || null,
    }

    const { error } = await supabase.from('jobs').insert(record)
    if (!error) inserted++
  }

  return inserted
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

function extractTech(text) {
  if (!text) return []
  const plain = stripHtml(text)
  return TECH_KEYWORDS.filter(tech =>
    plain.toLowerCase().includes(tech.toLowerCase())
  )
}

function guessType(location, workplaceType) {
  const loc = (location || '').toLowerCase()
  const wt = (workplaceType || '').toLowerCase()
  if (wt === 'remote' || loc.includes('remote')) return 'remote'
  if (wt === 'hybrid') return 'hybrid'
  return 'onsite'
}

function guessCountry(location) {
  const loc = (location || '').toLowerCase()
  if (loc.includes('korea') || loc.includes('seoul') || loc.includes('busan') || loc.includes('pangyo')) return 'korea'
  if (loc.includes('vietnam') || loc.includes('ho chi minh') || loc.includes('hanoi')) return 'vietnam'
  return 'global'
}

function simplifyLocation(location) {
  if (!location) return ''
  const loc = location.toLowerCase()
  if (loc.includes('remote')) return 'Remote'
  if (loc.includes('seoul')) return 'Seoul'
  if (loc.includes('pangyo') || loc.includes('seongnam')) return 'Pangyo'
  if (loc.includes('busan')) return 'Busan'
  if (loc.includes('ho chi minh')) return 'Ho Chi Minh City'
  if (loc.includes('hanoi')) return 'Hanoi'
  // Return first part for global locations
  return location.split(',')[0].trim()
}

function guessRole(title, techStack) {
  const t = (title || '').toLowerCase()
  if (t.includes('frontend') || t.includes('front-end') || t.includes('front end')) return 'Frontend'
  if (t.includes('backend') || t.includes('back-end') || t.includes('back end') || t.includes('server')) return 'Backend'
  if (t.includes('fullstack') || t.includes('full-stack') || t.includes('full stack')) return 'Fullstack'
  if (t.includes('mobile') || t.includes('ios') || t.includes('android')) return 'Mobile'
  if (t.includes('data') || t.includes('machine learning') || t.includes('ml') || t.includes('ai ')) return 'Data'
  if (t.includes('devops') || t.includes('sre') || t.includes('infrastructure') || t.includes('platform')) return 'DevOps'
  if (t.includes('product manager') || t.includes('program manager')) return 'PM'
  if (t.includes('design') || t.includes('ux') || t.includes('ui')) return 'Design'
  if (t.includes('qa') || t.includes('quality') || t.includes('test')) return 'QA'
  return 'Backend'
}

async function deactivateExpired() {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
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
