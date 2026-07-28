import supabase from '../../lib/supabaseAdmin'
import { inSalaryRange, cleanBounds } from '../../lib/salaryStats'
import { excludeSuspicious } from '../../lib/salaryQuality'

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

  try {
  // 1. Fetch all submissions for this company.
  //    Match case-insensitively (ilike) and re-filter by the same normalized
  //    key the companies list aggregates on (trim + lowercase), so a card that
  //    counts the "momo" bucket (DB stores "MoMo") doesn't open to an empty
  //    panel because of an exact-case `.eq` miss.
  //    LIKE 메타문자(\ % _)가 회사명에 있으면 패턴이 깨져 500이 나거나
  //    와일드카드로 다른 회사와 섞이므로 이스케이프.
  const wanted = company.trim().toLowerCase()
  const pattern = company.replace(/[\\%_]/g, '\\$&')
  const rawRows = (await fetchAll(
    supabase
      .from('submissions')
      .select('company, role, experience, salary, created_at, rating_worklife, rating_salary, rating_growth')
      .ilike('company', pattern)
      .order('created_at', { ascending: false })
  )).filter(r => (r.company || '').trim().toLowerCase() === wanted)

  if (!rawRows || rawRows.length === 0) return res.status(404).json({ error: 'No data' })

  // 1b. Filter: 슬라이더 기본값(62) 제외 → 하드범위 → IQR — 카드(/api/companies RPC)와 동일 정제
  const hardFiltered = excludeSuspicious(rawRows).filter(r => inSalaryRange(r.salary))
  const { lower, upper } = cleanBounds(hardFiltered.map(r => r.salary))
  const rows = hardFiltered.filter(r => r.salary >= lower && r.salary <= upper)

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

  // 4. Rating — compute from rows that have all 3 rating fields
  const ratingRows = rows.filter(r =>
    r.rating_worklife != null &&
    r.rating_salary != null &&
    r.rating_growth != null
  )
  const avg = arr => {
    if (!arr.length) return 0
    return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
  }
  const rating = ratingRows.length > 0 ? {
    worklife: avg(ratingRows.map(r => r.rating_worklife)),
    salary: avg(ratingRows.map(r => r.rating_salary)),
    growth: avg(ratingRows.map(r => r.rating_growth)),
    count: ratingRows.length,
  } : null

  // 5. Return
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate')
  return res.status(200).json({
    summary,
    feed,
    rating,
    totalCount: rows.length
  })
  } catch (err) {
    console.error('company-detail API error:', err)
    return res.status(500).json({ error: err.message })
  }
}
