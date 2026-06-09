import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const CATEGORIES = ['bug', 'feature', 'other']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { category, message, contact_email, platform, app_version } = req.body
  if (!CATEGORIES.includes(category) || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'invalid' })
  }

  const { error } = await supabase.from('app_feedback').insert({
    user_id: user.id,
    category,
    message: message.trim().slice(0, 2000),
    contact_email: contact_email || null,
    platform: platform || null,
    app_version: app_version || null,
  })

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true })
}
