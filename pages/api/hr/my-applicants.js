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

  const { data: hr } = await supabase.from('hr_users').select('status').eq('user_id', user.id).single()
  if (hr?.status !== 'approved') return null

  return user
}

export default async function handler(req, res) {
  const user = await verifyHR(req)
  if (!user) return res.status(401).json({ error: 'unauthorized' })

  // GET: list applicants for HR's OWN posted jobs only
  if (req.method === 'GET') {
    const { jobId, status: filterStatus } = req.query

    // Get only jobs posted by this HR user
    const { data: myJobs } = await supabase.from('jobs').select('id').eq('posted_by', user.id)
    const myJobIds = (myJobs || []).map(j => j.id)

    if (myJobIds.length === 0) {
      return res.json({ applicants: [], total: 0 })
    }

    // If jobId specified, verify it belongs to this HR user
    const targetJobIds = jobId ? [parseInt(jobId)] : myJobIds
    if (jobId && !myJobIds.includes(parseInt(jobId))) {
      return res.status(403).json({ error: 'not your job posting' })
    }

    let query = supabase
      .from('job_applications')
      .select('*')
      .in('job_id', targetJobIds)
      .order('created_at', { ascending: false })

    if (filterStatus && filterStatus !== 'all') {
      query = query.eq('status', filterStatus)
    }

    const { data: applicants, error } = await query
    if (error) return res.status(500).json({ error: error.message })

    return res.json({ applicants: applicants || [], total: (applicants || []).length })
  }

  // PATCH: update applicant status (only for own job's applicants)
  if (req.method === 'PATCH') {
    const { applicationId, status, admin_note } = req.body
    if (!applicationId) return res.status(400).json({ error: 'applicationId required' })

    const validStatuses = ['applied', 'viewed', 'reviewing', 'decided']
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'invalid status' })
    }

    // Verify the application belongs to one of the HR user's jobs
    const { data: app } = await supabase
      .from('job_applications')
      .select('job_id')
      .eq('id', applicationId)
      .single()

    if (!app) return res.status(404).json({ error: 'application not found' })

    const { data: job } = await supabase
      .from('jobs')
      .select('posted_by')
      .eq('id', app.job_id)
      .single()

    if (!job || job.posted_by !== user.id) {
      return res.status(403).json({ error: 'not your job posting' })
    }

    const updates = { updated_at: new Date().toISOString() }
    if (status) updates.status = status
    if (admin_note !== undefined) updates.admin_note = admin_note

    const { error } = await supabase
      .from('job_applications')
      .update(updates)
      .eq('id', applicationId)

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ success: true })
  }

  return res.status(405).json({ error: 'method not allowed' })
}
