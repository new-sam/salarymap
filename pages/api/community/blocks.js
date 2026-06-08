import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  // List the caller's blocked user ids (used by clients to filter feeds).
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('community_blocks')
      .select('blocked_id')
      .eq('blocker_id', user.id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ blocked_ids: (data || []).map(b => b.blocked_id) })
  }

  if (req.method === 'POST') {
    const { blocked_id } = req.body
    if (!blocked_id || blocked_id === user.id) return res.status(400).json({ error: 'invalid' })
    const { error } = await supabase
      .from('community_blocks')
      .upsert(
        { blocker_id: user.id, blocked_id },
        { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true }
      )
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ blocked: true })
  }

  if (req.method === 'DELETE') {
    const { blocked_id } = req.query
    if (!blocked_id) return res.status(400).json({ error: 'invalid' })
    const { error } = await supabase
      .from('community_blocks')
      .delete()
      .eq('blocker_id', user.id)
      .eq('blocked_id', blocked_id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ blocked: false })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
