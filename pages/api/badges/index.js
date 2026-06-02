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

  // GET: list user's badges
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('user_badges')
      .select('*')
      .eq('user_id', user.id)

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ badges: data })
  }

  // PUT: toggle badge active status
  if (req.method === 'PUT') {
    const { badge_type, is_active } = req.body
    if (!badge_type) return res.status(400).json({ error: 'badge_type required' })

    const { data, error } = await supabase
      .from('user_badges')
      .update({ is_active })
      .eq('user_id', user.id)
      .eq('badge_type', badge_type)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ badge: data })
  }

  return res.status(405).json({ error: 'method not allowed' })
}
