import supabase from '../../lib/supabase'

async function fetchAll(query) {
  const PAGE = 1000;
  let all = [], from = 0;
  while (true) {
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export default async function handler(req, res) {
  const { company, role, experience } = req.query
  if (!company) return res.status(400).json({ error: 'company required' })

  // 1. Fetch all submissions for this company
  const rows = await fetchAll(
    supabase
      .from('submissions')
      .select('role, experience, salary, created_at')
      .eq('company', company)
      .order('created_at', { ascending: false })
  )

  if (!rows || rows.length === 0) return res.status(404).json({ error: 'No data' })

  // 2. Compute summary (only if role + experience provided)
  let summary = null
  if (role && experience) {
    const exp = Number(experience)
    const similar = rows.filter(r =>
      r.role === role &&
      Math.abs(Number(r.experience) - exp) <= 1
    )
    const salaries = similar.map(r => r.salary).sort((a, b) => a - b)
    const p25 = salaries[Math.floor(salaries.length * 0.25)] || 0
    const median = salaries[Math.floor(salaries.length * 0.5)] || 0
    const p75 = salaries[Math.floor(salaries.length * 0.75)] || 0
    summary = { p25, median, p75, count: similar.length }
  }

  // 3. Build individual feed sorted by similarity
  const getPriority = (r) => {
    if (!role || !experience) return 0
    const exp = Number(experience)
    if (r.role === role && Math.abs(Number(r.experience) - exp) <= 1) return 0
    if (r.role === role) return 1
    return 2
  }
  const feed = [...rows].sort((a, b) => getPriority(a) - getPriority(b))
    .map(r => ({
      role: r.role,
      experience: r.experience,
      salary: r.salary,
      mostSimilar: !!(role && experience && r.role === role && Math.abs(Number(r.experience) - Number(experience)) <= 1),
      createdAt: r.created_at
    }))

  // 4. Rating — columns not yet in submissions table, return null for now
  const rating = null

  // 5. Return
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate')
  return res.status(200).json({
    summary,
    feed,
    rating,
    totalCount: rows.length
  })
}
