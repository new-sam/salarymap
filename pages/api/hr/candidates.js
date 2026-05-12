import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)

export default async function handler(req, res) {
  // Verify user is authenticated
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })

  // Check HR or admin access
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, email')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.email?.endsWith('@likelion.net')
  if (!isAdmin && profile?.role !== 'hr') {
    return res.status(403).json({ error: 'forbidden' })
  }

  // If HR, verify approved
  if (!isAdmin && profile?.role === 'hr') {
    const { data: hr } = await supabase.from('hr_users').select('status').eq('user_id', user.id).single()
    if (hr?.status !== 'approved') return res.status(403).json({ error: 'not approved' })
  }

  const { position, sort, order, page, limit: lim, search } = req.query
  const pageNum = Math.max(1, parseInt(page) || 1)
  const pageSize = Math.min(50, parseInt(lim) || 20)
  const offset = (pageNum - 1) * pageSize

  let query = supabase
    .from('candidates')
    .select('*', { count: 'exact' })

  // Filter by position
  if (position && position !== 'all') {
    query = query.eq('position', position)
  }

  // Search by name
  if (search) {
    query = query.or(`name_vi.ilike.%${search}%,name_en.ilike.%${search}%,tech_stack.cs.{${search}}`)
  }

  // Only show candidates with filled forms (have name)
  query = query.not('name_vi', 'is', null)
  query = query.neq('name_vi', '')

  // Sort
  const sortField = sort || 'stat_overall'
  const sortOrder = order === 'asc' ? true : false
  query = query.order(sortField, { ascending: sortOrder, nullsFirst: false })

  // Paginate
  query = query.range(offset, offset + pageSize - 1)

  const { data, count, error } = await query

  if (error) return res.status(500).json({ error: error.message })

  // Get HR's existing interests for these candidates
  const candidateIds = (data || []).map(c => c.id)
  let interests = []
  if (candidateIds.length > 0) {
    const { data: intData } = await supabase
      .from('hr_interests')
      .select('candidate_id, status')
      .eq('hr_user_id', user.id)
      .in('candidate_id', candidateIds)
    interests = intData || []
  }

  const interestMap = {}
  interests.forEach(i => { interestMap[i.candidate_id] = i.status })

  // Strip sensitive fields from candidates
  const sanitized = (data || []).map(c => ({
    id: c.id,
    name_vi: c.name_vi,
    name_en: c.name_en,
    position: c.position,
    age: c.age,
    location: c.location,
    yoe_months: c.yoe_months,
    yoe_raw: c.yoe_raw,
    tech_stack: c.tech_stack,
    university: c.university,
    major: c.major,
    graduation_status: c.graduation_status,
    english_level: c.english_level,
    english_cert: c.english_cert,
    korean_level: c.korean_level,
    projects: c.projects,
    cv_url: c.cv_url,
    want_korea: c.want_korea,
    stat_overall: c.stat_overall,
    stat_experience: c.stat_experience,
    stat_tech: c.stat_tech,
    stat_english: c.stat_english,
    stat_education: c.stat_education,
    stat_soft: c.stat_soft,
    interest: interestMap[c.id] || null,
  }))

  res.json({
    candidates: sanitized,
    total: count,
    page: pageNum,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  })
}
