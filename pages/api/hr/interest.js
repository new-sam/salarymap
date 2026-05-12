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
