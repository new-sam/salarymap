import { createClient } from '@supabase/supabase-js'

// Returns { id, email, full_name } for a set of applicant user ids, for the
// recruiter ATS. user_profiles is locked to own-row RLS, so recruiters can no
// longer read applicants' profiles directly with the anon client — they call
// this service-role endpoint, which first verifies the caller is an approved
// recruiter.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })

  const { data: rec } = await supabase
    .from('recruiter_users')
    .select('company_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!rec?.company_id) return res.status(403).json({ error: 'forbidden' })

  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(Boolean).slice(0, 500) : []
  if (ids.length === 0) return res.json({ profiles: [] })

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, email, full_name')
    .in('id', ids)
  if (error) return res.status(500).json({ error: 'internal_error' })

  res.setHeader('Cache-Control', 'no-store')
  return res.json({ profiles: data || [] })
}
