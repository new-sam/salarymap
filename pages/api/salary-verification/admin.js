import { createClient } from '@supabase/supabase-js'
import { normalizeTrieu } from '../../../lib/salaryTiers'

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)

async function isAdmin(email) {
  const { data } = await supabase.from('admin_users').select('email').eq('email', email).single()
  return !!data
}

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })

  if (!(await isAdmin(user.email))) return res.status(403).json({ error: 'forbidden' })

  // GET: list all verification requests
  if (req.method === 'GET') {
    const status = req.query.status || 'pending'
    let query = supabase
      .from('salary_verifications')
      .select('*')
      .order('created_at', { ascending: false })

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })

    // Get user profile info
    const userIds = [...new Set(data.map(d => d.user_id))]
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, full_name, verified_company_name, photo_url')
      .in('id', userIds)

    const profileMap = {}
    profiles?.forEach(p => { profileMap[p.id] = p })

    // salary-docs is a private bucket; the stored document_url is a public URL that
    // returns "Bucket not found". Re-sign each doc so the admin can open it (1h TTL).
    const enriched = await Promise.all(data.map(async d => {
      let document_url = d.document_url
      const marker = '/salary-docs/'
      const i = d.document_url?.indexOf(marker) ?? -1
      if (i !== -1) {
        const path = decodeURIComponent(d.document_url.slice(i + marker.length).split('?')[0])
        const { data: signed } = await supabase.storage.from('salary-docs').createSignedUrl(path, 3600)
        if (signed?.signedUrl) document_url = signed.signedUrl
      }
      return { ...d, document_url, profile: profileMap[d.user_id] || null }
    }))

    return res.json({ verifications: enriched })
  }

  // PUT: approve or reject
  if (req.method === 'PUT') {
    const { id, status, admin_note, salary_amount } = req.body
    if (!id || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'id and valid status required' })
    }

    // Approval requires the admin-verified monthly salary in 백만 VND (triệu) — it
    // determines the badge tier. Stored on the row in triệu; converted to VND for the badge.
    let verifiedTrieu = null
    if (status === 'approved') {
      // Coerce a raw-VND amount sent by mistake (e.g. 50000000) back into triệu
      // so the badge tier — which is irreversible once granted — uses the right unit.
      verifiedTrieu = normalizeTrieu(parseInt(salary_amount, 10))
      if (!verifiedTrieu || verifiedTrieu <= 0) {
        return res.status(400).json({ error: 'salary_amount required to approve' })
      }
    }

    const updateFields = {
      status,
      admin_note: admin_note || null,
      reviewed_by: user.email,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    if (verifiedTrieu != null) updateFields.salary_amount = verifiedTrieu

    const { data: verification, error: updateErr } = await supabase
      .from('salary_verifications')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single()

    if (updateErr) return res.status(500).json({ error: updateErr.message })

    // If approved, grant/refresh the salary-range badge. The badge stores the raw
    // monthly amount in VND (triệu * 1,000,000) because the tier engine (lib/salaryTiers
    // and the app) thresholds in VND. New badges default to visible (is_active=true) so an
    // approval shows up immediately in the app, which has no toggle; a re-approval keeps the
    // user's existing choice (so toggling off on the web isn't undone).
    if (status === 'approved') {
      const { data: existing } = await supabase
        .from('user_badges')
        .select('is_active')
        .eq('user_id', verification.user_id)
        .eq('badge_type', 'salary_range')
        .maybeSingle()

      await supabase
        .from('user_badges')
        .upsert({
          user_id: verification.user_id,
          badge_type: 'salary_range',
          salary_amount: verifiedTrieu * 1000000,
          is_active: existing?.is_active ?? true,
          granted_at: new Date().toISOString(),
        }, { onConflict: 'user_id,badge_type' })
    }

    return res.json({ verification })
  }

  return res.status(405).json({ error: 'method not allowed' })
}
