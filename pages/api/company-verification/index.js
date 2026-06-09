import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })

  const { data } = await supabase
    .from('user_profiles')
    .select('user_type, verified_company_name, verified_company_domain, company_verified_at, verified_school_name, verified_school_domain, school_verified_at')
    .eq('id', user.id)
    .maybeSingle()

  return res.json({
    // Company fields kept at top level for backward compatibility with existing callers.
    verified: !!data?.company_verified_at,
    company_name: data?.verified_company_name || null,
    domain: data?.verified_company_domain || null,
    verified_at: data?.company_verified_at || null,
    // Declared student/worker classification + the student-side school verification.
    user_type: data?.user_type || null,
    school: {
      verified: !!data?.school_verified_at,
      school_name: data?.verified_school_name || null,
      domain: data?.verified_school_domain || null,
      verified_at: data?.school_verified_at || null,
    },
  })
}
