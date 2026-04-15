import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from './check'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  const admin = await verifyAdmin(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const { data } = await supabase
      .from('job_applications')
      .select('*, jobs(title, company)')
      .order('created_at', { ascending: false })

    const userIds = [...new Set((data || []).map(a => a.user_id).filter(Boolean))]
    let profileMap = {}
    if (userIds.length) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, email, full_name')
        .in('id', userIds)
      ;(profiles || []).forEach(p => { profileMap[p.id] = p })
    }

    const enriched = (data || []).map(a => ({
      ...a,
      user_email: a.applicant_email || profileMap[a.user_id]?.email || '—',
      user_name: a.applicant_name || profileMap[a.user_id]?.full_name || '—',
    }))

    return res.status(200).json(enriched)
  }

  if (req.method === 'PUT') {
    const { id, status, admin_note } = req.body
    const updates = { status, updated_at: new Date().toISOString() }
    if (admin_note !== undefined) updates.admin_note = admin_note
    const { error } = await supabase
      .from('job_applications')
      .update(updates)
      .eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
