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
    .select('verified_company_name, verified_company_domain, company_verified_at')
    .eq('id', user.id)
    .maybeSingle()

  return res.json({
    verified: !!data?.company_verified_at,
    company_name: data?.verified_company_name || null,
    domain: data?.verified_company_domain || null,
    verified_at: data?.company_verified_at || null,
  })
}
