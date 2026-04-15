import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ADMIN_EMAILS = ['slsvm@hotmail.com', 'kee@likelion.net']

async function verifyAdmin(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  if (!ADMIN_EMAILS.includes(user.email)) return null
  return user
}

export default async function handler(req, res) {
  const admin = await verifyAdmin(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const { data } = await supabase
      .from('job_applications')
      .select('*, jobs(title, company)')
      .order('created_at', { ascending: false })

    // Get user emails
    const userIds = [...new Set((data || []).map(a => a.user_id).filter(Boolean))]
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, email, full_name')
      .in('id', userIds)

    const profileMap = {}
    ;(profiles || []).forEach(p => { profileMap[p.id] = p })

    const enriched = (data || []).map(a => ({
      ...a,
      user_email: profileMap[a.user_id]?.email || '—',
      user_name: profileMap[a.user_id]?.full_name || '—',
    }))

    return res.status(200).json(enriched)
  }

  // PUT — update status
  if (req.method === 'PUT') {
    const { id, status } = req.body
    const { error } = await supabase
      .from('job_applications')
      .update({ status })
      .eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
