import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)

async function verifyHR(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'hr') return null

  const { data: hr } = await supabase.from('hr_users').select('status').eq('user_id', user.id).single()
  if (hr?.status !== 'approved') return null

  return user
}

export default async function handler(req, res) {
  const user = await verifyHR(req)
  if (!user) return res.status(401).json({ error: 'unauthorized' })

  // GET: list saved candidates with details
  if (req.method === 'GET') {
    const { status: filterStatus } = req.query

    let query = supabase
      .from('hr_interests')
      .select('*')
      .eq('hr_user_id', user.id)
      .order('updated_at', { ascending: false })

    if (filterStatus && filterStatus !== 'all') {
      query = query.eq('status', filterStatus)
    }

    const { data: interests, error } = await query
    if (error) return res.status(500).json({ error: error.message })

    if (!interests || interests.length === 0) {
      return res.json({ saved: [], total: 0 })
    }

    // Fetch candidate details
    const candidateIds = interests.map(i => i.candidate_id)
    const { data: candidates } = await supabase
      .from('candidates')
      .select('id, name_vi, name_en, position, location, yoe_months, yoe_raw, tech_stack, university, stat_overall, stat_experience, stat_tech, stat_english, stat_education, stat_soft')
      .in('id', candidateIds)

    const candidateMap = {}
    ;(candidates || []).forEach(c => { candidateMap[c.id] = c })

    const saved = interests.map(i => ({
      interestId: i.id,
      status: i.status,
      message: i.message,
      savedAt: i.created_at,
      updatedAt: i.updated_at,
      candidate: candidateMap[i.candidate_id] || null,
    })).filter(s => s.candidate)

    return res.json({ saved, total: saved.length })
  }

  // PATCH: update interest status
  if (req.method === 'PATCH') {
    const { interestId, status, message } = req.body
    if (!interestId) return res.status(400).json({ error: 'interestId required' })

    const validStatuses = ['pending', 'contacted', 'matched', 'rejected']
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'invalid status' })
    }

    const updates = { updated_at: new Date().toISOString() }
    if (status) updates.status = status
    if (message !== undefined) updates.message = message

    const { error } = await supabase
      .from('hr_interests')
      .update(updates)
      .eq('id', interestId)
      .eq('hr_user_id', user.id)

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ success: true })
  }

  // DELETE: remove saved candidate
  if (req.method === 'DELETE') {
    const { interestId } = req.body
    if (!interestId) return res.status(400).json({ error: 'interestId required' })

    const { error } = await supabase
      .from('hr_interests')
      .delete()
      .eq('id', interestId)
      .eq('hr_user_id', user.id)

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ success: true })
  }

  return res.status(405).json({ error: 'method not allowed' })
}
