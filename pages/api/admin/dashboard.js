import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from './check'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  const user = await verifyAdmin(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { from, to } = req.query
  const startDate = from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const endDate = to || new Date().toISOString().slice(0, 10)

  const startISO = `${startDate}T00:00:00`
  const endISO = `${endDate}T23:59:59`

  // Fetch all submissions in date range
  const { data: submissions, error } = await supabase
    .from('submissions')
    .select('id, created_at, company, intent, utm_source, utm_medium, utm_campaign, user_id, email')
    .gte('created_at', startISO)
    .lte('created_at', endISO)
    .order('created_at', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })

  // Fetch sign-ups (auth.users) in date range using admin API
  let signups = []
  try {
    // Use admin API to list users - paginate through all
    let page = 1
    let allUsers = []
    while (true) {
      const { data: { users }, error: authErr } = await supabase.auth.admin.listUsers({
        page,
        perPage: 1000,
      })
      if (authErr || !users || users.length === 0) break
      allUsers = allUsers.concat(users)
      if (users.length < 1000) break
      page++
    }
    signups = allUsers.filter(u => {
      const d = u.created_at
      return d >= startISO && d <= endISO
    })
  } catch (e) {
    // If admin API not available, skip signups
  }

  // Fetch job applications in date range
  const { data: jobApps } = await supabase
    .from('job_applications')
    .select('id, created_at')
    .gte('created_at', startISO)
    .lte('created_at', endISO)

  // --- Aggregate daily trend ---
  const dailyMap = {}
  for (const sub of submissions) {
    const date = sub.created_at.slice(0, 10)
    if (!dailyMap[date]) dailyMap[date] = { date, submissions: 0, ad: 0, organic: 0, signups: 0, companies: new Set(), jobApps: 0 }
    dailyMap[date].submissions++
    if (sub.utm_source || sub.utm_medium || sub.utm_campaign) {
      dailyMap[date].ad++
    } else {
      dailyMap[date].organic++
    }
    if (sub.company) dailyMap[date].companies.add(sub.company.trim().toLowerCase())
  }

  for (const s of signups) {
    const date = s.created_at.slice(0, 10)
    if (!dailyMap[date]) dailyMap[date] = { date, submissions: 0, ad: 0, organic: 0, signups: 0, companies: new Set(), jobApps: 0 }
    dailyMap[date].signups++
  }

  for (const ja of (jobApps || [])) {
    const date = ja.created_at.slice(0, 10)
    if (!dailyMap[date]) dailyMap[date] = { date, submissions: 0, ad: 0, organic: 0, signups: 0, companies: new Set(), jobApps: 0 }
    dailyMap[date].jobApps++
  }

  const daily = Object.values(dailyMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({ ...d, companies: d.companies.size }))

  // --- Intent breakdown ---
  const intentCounts = {}
  let preTracking = 0
  for (const sub of submissions) {
    if (!sub.intent) { preTracking++; continue }
    intentCounts[sub.intent] = (intentCounts[sub.intent] || 0) + 1
  }
  const intentLabels = {
    open: '적극 구직 중',
    selective: '맞는 곳이면 고려',
    none: '현재는 아님',
    maybe_later: '나중에 고려',
    dismissed: '관심 없음',
  }
  const intent = Object.entries(intentCounts).map(([key, count]) => ({
    name: intentLabels[key] || key,
    value: count,
    pct: ((count / submissions.length) * 100).toFixed(1),
  }))
  intent.push({ name: '추적 이전', value: preTracking, pct: ((preTracking / submissions.length) * 100).toFixed(1) })

  // --- Top companies ---
  const companyMap = {}
  for (const sub of submissions) {
    if (!sub.company) continue
    const name = sub.company.trim()
    companyMap[name] = (companyMap[name] || 0) + 1
  }
  const topCompanies = Object.entries(companyMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, count]) => ({ name, count }))

  // --- Summary ---
  const uniqueCompanies = new Set(submissions.filter(s => s.company).map(s => s.company.trim().toLowerCase()))
  const interested = (intentCounts.open || 0) + (intentCounts.selective || 0)

  const summary = {
    totalSubmissions: submissions.length,
    adSubmissions: submissions.filter(s => s.utm_source || s.utm_medium || s.utm_campaign).length,
    organicSubmissions: submissions.filter(s => !s.utm_source && !s.utm_medium && !s.utm_campaign).length,
    totalSignups: signups.length,
    totalJobApps: (jobApps || []).length,
    uniqueCompanies: uniqueCompanies.size,
    interested,
    signupRate: submissions.length > 0 ? ((signups.length / submissions.length) * 100).toFixed(1) : '0',
  }

  res.json({ summary, daily, intent, topCompanies })
}
