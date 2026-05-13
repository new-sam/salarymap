import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from './check'

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)

export default async function handler(req, res) {
  const admin = await verifyAdmin(req)
  if (!admin) return res.status(401).json({ error: 'unauthorized' })

  if (req.method === 'GET') {
    // List all HR users with their profiles
    const { data, error } = await supabase
      .from('hr_users')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })

    // Fetch user emails from auth.users
    const userIds = (data || []).map(h => h.user_id)
    const userMap = {}
    if (userIds.length > 0) {
      for (const uid of userIds) {
        const { data: { user } } = await supabase.auth.admin.getUserById(uid)
        if (user) {
          userMap[uid] = { email: user.email, fullName: user.user_metadata?.full_name || '' }
        }
      }
    }

    const users = (data || []).map(h => ({
      id: h.id,
      userId: h.user_id,
      email: userMap[h.user_id]?.email || '',
      fullName: userMap[h.user_id]?.fullName || '',
      companyName: h.company_name,
      contactName: h.contact_name || '',
      phone: h.phone || '',
      position: h.position || '',
      companySize: h.company_size || '',
      purpose: h.purpose || '',
      businessNumber: h.business_number || '',
      status: h.status,
      createdAt: h.created_at,
      submittedAt: h.submitted_at,
      approvedAt: h.approved_at,
      approvedBy: h.approved_by,
    }))

    return res.json({ users })
  }

  if (req.method === 'PATCH') {
    // Approve or reject HR user
    const { userId, status, companyName } = req.body
    if (!userId || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'userId and status (approved/rejected) required' })
    }

    const update = {
      status,
      ...(status === 'approved' ? { approved_at: new Date().toISOString(), approved_by: admin.email } : {}),
      ...(companyName ? { company_name: companyName } : {}),
    }

    const { error } = await supabase
      .from('hr_users')
      .update(update)
      .eq('user_id', userId)

    if (error) return res.status(500).json({ error: error.message })

    // If rejected, reset role to seeker
    if (status === 'rejected') {
      await supabase.from('user_profiles').update({ role: 'seeker' }).eq('id', userId)
    }

    return res.json({ success: true })
  }

  res.status(405).json({ error: 'method not allowed' })
}
