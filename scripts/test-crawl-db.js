// 크롤러 DB insert 테스트 (1건만)
// Usage: node --env-file=.env.local scripts/test-crawl-db.js

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const WANTED_API = 'https://www.wanted.co.kr/api/v4/jobs'

const TECH_KEYWORDS = [
  'React', 'Vue', 'Angular', 'Next.js', 'Node.js', 'Express',
  'TypeScript', 'JavaScript', 'Python', 'Java', 'Kotlin', 'Go', 'Rust',
  'Spring', 'Django', 'FastAPI', 'NestJS',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis',
  'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes',
  'Git', 'GraphQL', 'Flutter', 'React Native', 'Swift',
]

async function test() {
  console.log('=== DB Insert 테스트 (1건) ===\n')

  // 목록 1개만
  const resp = await fetch(`${WANTED_API}?country=kr&tag_type_ids=518&location=all&years=-1&limit=1&offset=0`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  })
  const data = await resp.json()
  const listItem = data.data[0]

  // 중복 체크
  const { data: existing } = await supabase
    .from('jobs')
    .select('id')
    .eq('source', 'wanted')
    .eq('source_id', String(listItem.id))

  if (existing?.length > 0) {
    console.log(`이미 존재: ${listItem.position} (source_id: ${listItem.id})`)
    console.log('중복 방지 OK!')
    return
  }

  // 상세
  const detailResp = await fetch(`${WANTED_API}/${listItem.id}`, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const detail = (await detailResp.json()).job

  const skillTags = (detail.skill_tags || []).map(s => s.title).filter(Boolean)
  const techStack = skillTags.length > 0 ? skillTags : extractTech(detail.detail?.requirements || '')

  const benefits = detail.detail?.benefits
    ? detail.detail.benefits.split('\n').map(s => s.replace(/^[•\-\s]+/, '').trim()).filter(s => s.length > 0 && s.length < 100).slice(0, 10)
    : []

  const record = {
    title: detail.position,
    company: detail.company?.name || '',
    company_initials: (detail.company?.name || '').slice(0, 2).toUpperCase(),
    location: detail.address?.full_location || 'Seoul',
    type: 'remote',
    country: 'korea',
    role: guessRole(detail.position, techStack),
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
    apply_url: `https://www.wanted.co.kr/wd/${listItem.id}`,
    source: 'wanted',
    source_id: String(listItem.id),
  }

  console.log('Insert record:')
  console.log(JSON.stringify(record, null, 2))
  console.log('')

  const { data: inserted, error } = await supabase.from('jobs').insert(record).select().single()

  if (error) {
    console.error('INSERT ERROR:', error.message)
  } else {
    console.log(`SUCCESS! id: ${inserted.id}`)
    console.log(`Title: ${inserted.title} @ ${inserted.company}`)

    // 바로 삭제 (테스트니까)
    // await supabase.from('jobs').delete().eq('id', inserted.id)
    // console.log('(테스트 데이터 삭제 완료)')
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

function extractTech(text) {
  if (!text) return []
  return TECH_KEYWORDS.filter(tech => text.toLowerCase().includes(tech.toLowerCase()))
}

function guessRole(title, techStack) {
  const t = (title || '').toLowerCase()
  const stack = techStack.join(' ').toLowerCase()
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

test().catch(console.error)
