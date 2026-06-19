import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from './check'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// 어드민: 가입 회사 계정 목록 + 인증 토글
export default async function handler(req, res) {
  const admin = await verifyAdmin(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const { data: companies } = await supabase
      .from('recruiter_companies')
      .select('id, name, email_domain, verified_at, created_at')
      .order('created_at', { ascending: false })
    const list = companies || []
    const ids = list.map(c => c.id)

    // 멤버 수 / 공고 수 집계
    let members = [], jobs = []
    if (ids.length) {
      const { data: m } = await supabase.from('recruiter_users').select('company_id, email').in('company_id', ids)
      members = m || []
      const { data: j } = await supabase.from('jobs').select('company_id, status, is_active').in('company_id', ids)
      jobs = j || []
    }
    const memberCount = {}, jobCount = {}, liveCount = {}
    members.forEach(m => { memberCount[m.company_id] = (memberCount[m.company_id] || 0) + 1 })
    jobs.forEach(j => {
      jobCount[j.company_id] = (jobCount[j.company_id] || 0) + 1
      if (j.is_active && j.status !== 'pending_review') liveCount[j.company_id] = (liveCount[j.company_id] || 0) + 1
    })

    return res.status(200).json(list.map(c => ({
      ...c,
      member_count: memberCount[c.id] || 0,
      job_count: jobCount[c.id] || 0,
      live_count: liveCount[c.id] || 0,
    })))
  }

  if (req.method === 'PUT') {
    const { id, verified } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id required' })
    const { error } = await supabase
      .from('recruiter_companies')
      .update({ verified_at: verified ? new Date().toISOString() : null })
      .eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
