import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)

async function verifyHR(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'hr') return null

  const { data: hr } = await supabase.from('hr_users').select('status, company_name').eq('user_id', user.id).single()
  if (hr?.status !== 'approved') return null

  return { ...user, companyName: hr.company_name }
}

export default async function handler(req, res) {
  const user = await verifyHR(req)
  if (!user) return res.status(401).json({ error: 'unauthorized' })

  // GET: list HR user's own jobs
  if (req.method === 'GET') {
    let query = supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false })

    query = query.eq('posted_by', user.id)

    const { data: jobs, error } = await query
    if (error) return res.status(500).json({ error: error.message })

    // Get application counts per job
    const jobIds = (jobs || []).map(j => j.id)
    let appCounts = {}

    if (jobIds.length > 0) {
      const { data: apps } = await supabase
        .from('job_applications')
        .select('job_id, status')
        .in('job_id', jobIds)

      ;(apps || []).forEach(a => {
        if (!appCounts[a.job_id]) appCounts[a.job_id] = { total: 0, applied: 0, viewed: 0, reviewing: 0, decided: 0 }
        appCounts[a.job_id].total++
        appCounts[a.job_id][a.status] = (appCounts[a.job_id][a.status] || 0) + 1
      })
    }

    const enriched = (jobs || []).map(j => ({
      id: j.id,
      title: j.title,
      company: j.company,
      description: j.description,
      logo_url: j.logo_url,
      tech_stack: j.tech_stack,
      benefits: j.benefits,
      deadline: j.deadline,
      headcount: j.headcount,
      location: j.location,
      salary_min: j.salary_min,
      salary_max: j.salary_max,
      salary_currency: j.salary_currency,
      job_type: j.job_type,
      experience_level: j.experience_level,
      is_active: j.is_active,
      created_at: j.created_at,
      applications: appCounts[j.id] || { total: 0, applied: 0, viewed: 0, reviewing: 0, decided: 0 },
    }))

    return res.json({ jobs: enriched, total: enriched.length })
  }

  // POST: create a new job posting
  if (req.method === 'POST') {
    const {
      title, company, description, tech_stack, benefits,
      deadline, headcount, location, salary_min, salary_max,
      salary_currency, job_type, experience_level, logo_url,
    } = req.body

    if (!title || !company) {
      return res.status(400).json({ error: 'title and company are required' })
    }

    const { data, error } = await supabase
      .from('jobs')
      .insert({
        title,
        company,
        description: description || null,
        tech_stack: tech_stack || [],
        benefits: benefits || [],
        deadline: deadline || null,
        headcount: headcount || null,
        location: location || null,
        salary_min: salary_min || null,
        salary_max: salary_max || null,
        salary_currency: salary_currency || 'KRW',
        job_type: job_type || 'full-time',
        experience_level: experience_level || null,
        logo_url: logo_url || null,
        posted_by: user.id,
        source: 'hr',
        is_active: true,
      })
      .select('id')
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ success: true, id: data.id })
  }

  // PATCH: update a job posting
  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })

    const allowed = [
      'title', 'company', 'description', 'tech_stack', 'benefits',
      'deadline', 'headcount', 'location', 'salary_min', 'salary_max',
      'salary_currency', 'job_type', 'experience_level', 'is_active', 'logo_url',
    ]
    const filtered = {}
    allowed.forEach(k => { if (updates[k] !== undefined) filtered[k] = updates[k] })
    filtered.updated_at = new Date().toISOString()

    let query = supabase.from('jobs').update(filtered).eq('id', id).eq('posted_by', user.id)

    const { error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ success: true })
  }

  // DELETE: remove a job posting
  if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })

    let query = supabase.from('jobs').delete().eq('id', id).eq('posted_by', user.id)

    const { error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ success: true })
  }

  return res.status(405).json({ error: 'method not allowed' })
}
