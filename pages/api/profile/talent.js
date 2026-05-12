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

  if (req.method === 'GET') {
    const { data } = await supabase.from('user_profiles').select('*').eq('id', user.id).single()
    return res.json({ profile: data })
  }

  if (req.method === 'PUT') {
    const fields = req.body
    // Whitelist allowed fields
    const allowed = [
      'full_name', 'headline', 'position', 'yoe_months', 'intro', 'skills',
      'english_cert', 'korean_cert', 'location', 'birthdate', 'university',
      'major', 'graduation_year', 'salary_min', 'salary_max', 'work_type',
      'job_signal', 'hr_visible', 'photo_url', 'resume_url',
      'experiences', 'projects', 'certs', 'portfolio_url',
    ]
    const update = { updated_at: new Date().toISOString() }
    for (const key of allowed) {
      if (key in fields) update[key] = fields[key]
    }

    const { error } = await supabase.from('user_profiles').update(update).eq('id', user.id)
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ success: true })
  }

  res.status(405).json({ error: 'method not allowed' })
}
