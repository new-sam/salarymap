import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const TARGET_TYPES = ['post', 'comment']
const REASONS = ['spam', 'abuse', 'sexual', 'falseInfo', 'other']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { target_type, target_id, reason } = req.body
  if (!TARGET_TYPES.includes(target_type) || !target_id || !REASONS.includes(reason)) {
    return res.status(400).json({ error: 'invalid' })
  }

  // Duplicate report on the same target is a no-op success (UNIQUE conflict ignored).
  const { error } = await supabase
    .from('community_reports')
    .upsert(
      { reporter_id: user.id, target_type, target_id, reason },
      { onConflict: 'reporter_id,target_type,target_id', ignoreDuplicates: true }
    )

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true })
}
