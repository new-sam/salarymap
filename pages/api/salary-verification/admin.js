import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)

async function isAdmin(email) {
  const { data } = await supabase.from('admin_users').select('email').eq('email', email).single()
  return !!data
}

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })

  if (!(await isAdmin(user.email))) return res.status(403).json({ error: 'forbidden' })

  // GET: list all verification requests
  if (req.method === 'GET') {
    const status = req.query.status || 'pending'
    let query = supabase
      .from('salary_verifications')
      .select('*, user:user_id(email, raw_user_meta_data)')
      .order('created_at', { ascending: false })

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })

    // Get user profile info
    const userIds = [...new Set(data.map(d => d.user_id))]
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, full_name, current_company, photo_url')
      .in('id', userIds)

    const profileMap = {}
    profiles?.forEach(p => { profileMap[p.id] = p })

    const enriched = data.map(d => ({
      ...d,
      profile: profileMap[d.user_id] || null,
    }))

    return res.json({ verifications: enriched })
  }

  // PUT: approve or reject
  if (req.method === 'PUT') {
    const { id, status, admin_note } = req.body
    if (!id || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'id and valid status required' })
    }

    const { data: verification, error: updateErr } = await supabase
      .from('salary_verifications')
      .update({
        status,
        admin_note: admin_note || null,
        reviewed_by: user.email,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (updateErr) return res.status(500).json({ error: updateErr.message })

    // If approved, grant high_salary badge
    if (status === 'approved') {
      await supabase
        .from('user_badges')
        .upsert({
          user_id: verification.user_id,
          badge_type: 'high_salary',
          is_active: false,
          granted_at: new Date().toISOString(),
        }, { onConflict: 'user_id,badge_type' })
    }

    return res.json({ verification })
  }

  return res.status(405).json({ error: 'method not allowed' })
}
