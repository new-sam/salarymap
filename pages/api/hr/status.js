import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)

export default async function handler(req, res) {
  const { userId } = req.query
  if (!userId) return res.status(400).json({ error: 'userId required' })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (!profile || profile.role !== 'hr') {
    return res.json({ isHR: false })
  }

  const { data: hr } = await supabase
    .from('hr_users')
    .select('status, company_name')
    .eq('user_id', userId)
    .single()

  return res.json({
    isHR: true,
    status: hr?.status || 'pending',
    companyName: hr?.company_name || '',
  })
}
