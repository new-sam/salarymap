import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })

  // HR role + approved only
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'hr') return res.status(403).json({ error: 'forbidden' })
  const { data: hrUser } = await supabase.from('hr_users').select('status').eq('user_id', user.id).single()
  if (hrUser?.status !== 'approved') return res.status(403).json({ error: 'not approved' })

  const { candidateId, message } = req.body
  if (!candidateId) return res.status(400).json({ error: 'candidateId required' })

  const { error } = await supabase.from('hr_interests').upsert({
    hr_user_id: user.id,
    candidate_id: candidateId,
    message: message || null,
    status: 'pending',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'hr_user_id,candidate_id' })

  if (error) return res.status(500).json({ error: error.message })

  res.json({ success: true })
}
