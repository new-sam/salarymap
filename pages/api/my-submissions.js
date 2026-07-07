import { createClient } from '@supabase/supabase-js'

// Returns the caller's own salary submissions. The submissions table's PII
// columns (email, claim_token_hash, ...) are no longer readable by the anon /
// authenticated client after the RLS/column lockdown, so the profile page
// fetches its own rows through this service-role endpoint instead of reading the
// table directly. Rows are scoped to the authenticated user by user_id, with an
// email fallback for legacy rows submitted before the account was linked.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const FIELDS = 'id, role, experience, salary, company, created_at, rating_worklife, rating_salary, rating_growth, intent, source'

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })

  const { data, error } = await supabase
    .from('submissions')
    .select(FIELDS)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: 'internal_error' })

  let submissions = data || []
  if (submissions.length === 0 && user.email) {
    const { data: byEmail } = await supabase
      .from('submissions')
      .select(FIELDS)
      .eq('email', user.email)
      .order('created_at', { ascending: false })
    submissions = byEmail || []
  }

  res.setHeader('Cache-Control', 'no-store')
  return res.json({ submissions })
}
