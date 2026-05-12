import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'hr') {
    return res.status(403).json({ error: 'forbidden' })
  }

  const { data: hr } = await supabase.from('hr_users').select('status').eq('user_id', user.id).single()
  if (hr?.status !== 'approved') return res.status(403).json({ error: 'not approved' })

  // 내가 등록한 공고만
  const { data: myJobs } = await supabase.from('jobs').select('id, is_active').eq('posted_by', user.id)
  const jobCount = (myJobs || []).length
  const activeJobCount = (myJobs || []).filter(j => j.is_active).length

  // 내 공고에 들어온 지원자만
  const myJobIds = (myJobs || []).map(j => j.id)
  let applicantStats = { total: 0, applied: 0, viewed: 0, reviewing: 0, decided: 0 }
  if (myJobIds.length > 0) {
    const { data: apps } = await supabase
      .from('job_applications')
      .select('status')
      .in('job_id', myJobIds)

    ;(apps || []).forEach(a => {
      applicantStats.total++
      applicantStats[a.status] = (applicantStats[a.status] || 0) + 1
    })
  }

  res.json({
    jobs: { total: jobCount, active: activeJobCount },
    applicants: applicantStats,
  })
}
