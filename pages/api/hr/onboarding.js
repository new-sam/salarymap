import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)

export default async function handler(req, res) {
  // Get user from auth header
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })

  const anonClient = createClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim(),
  )
  const { data: { user }, error: authErr } = await anonClient.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })

  if (req.method === 'GET') {
    const { data } = await supabase
      .from('hr_users')
      .select('*')
      .eq('user_id', user.id)
      .single()

    return res.json({ hr: data || null })
  }

  if (req.method === 'POST') {
    const { companyName, contactName, phone, position, companySize, purpose, businessNumber } = req.body

    if (!companyName || !contactName || !phone) {
      return res.status(400).json({ error: 'companyName, contactName, phone required' })
    }

    // Only allow submission from pending or rejected status
    const { data: existing } = await supabase
      .from('hr_users')
      .select('status')
      .eq('user_id', user.id)
      .single()

    if (existing && existing.status === 'approved') {
      return res.status(400).json({ error: 'already approved' })
    }
    if (existing && existing.status === 'submitted') {
      return res.status(400).json({ error: 'already submitted' })
    }

    const { error } = await supabase
      .from('hr_users')
      .update({
        company_name: companyName,
        contact_name: contactName,
        phone,
        position: position || null,
        company_size: companySize || null,
        purpose: purpose || null,
        business_number: businessNumber || null,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ success: true })
  }

  res.status(405).json({ error: 'method not allowed' })
}
