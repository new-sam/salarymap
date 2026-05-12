import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })

  // Check HR role + approved
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'hr') return res.status(403).json({ error: 'forbidden' })

  const { data: hr } = await supabase.from('hr_users').select('status').eq('user_id', user.id).single()
  if (hr?.status !== 'approved') return res.status(403).json({ error: 'not approved' })

  const { position, search, id: profileId } = req.query

  // Single profile by ID
  if (profileId) {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', profileId)
      .eq('hr_visible', true)
      .single()
    if (!data) return res.status(404).json({ error: 'not found' })
    return res.json({ profile: sanitize(data) })
  }

  // List visible profiles
  let query = supabase
    .from('user_profiles')
    .select('*')
    .eq('hr_visible', true)
    .not('full_name', 'is', null)
    .neq('full_name', '')

  if (position && position !== '전체') {
    query = query.eq('position', position)
  }

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,skills.cs.{${search}},position.ilike.%${search}%`)
  }

  query = query.order('updated_at', { ascending: false })

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  res.json({ profiles: (data || []).map(sanitize) })
}

function sanitize(p) {
  return {
    id: p.id,
    name: p.full_name,
    photo: p.photo_url,
    headline: p.headline,
    position: p.position,
    yoe_months: p.yoe_months,
    signal: p.job_signal || 'passive',
    location: p.location,
    skills: p.skills || [],
    intro: p.intro,
    university: p.university,
    major: p.major,
    graduation: p.graduation_year,
    salary_min: p.salary_min,
    salary_max: p.salary_max,
    salary_currency: p.salary_currency,
    work_type: p.work_type,
    english_cert: p.english_cert,
    korean_cert: p.korean_cert,
    birthdate: p.birthdate,
    experiences: p.experiences || [],
    projects: p.projects || [],
    certs: p.certs || [],
    portfolio_url: p.portfolio_url,
    resume_url: p.resume_url,
    updated_at: p.updated_at,
  }
}
