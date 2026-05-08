import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from './check'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  const user = await verifyAdmin(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { from, to, lang } = req.query
  const startDate = from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const endDate = to || new Date().toISOString().slice(0, 10)

  const startISO = `${startDate}T00:00:00`
  const endISO = `${endDate}T23:59:59`

  // Fetch all submissions in date range (paginate to avoid 1000-row default limit)
  let submissions = []
  {
    let from = 0
    const PAGE = 1000
    while (true) {
      const { data, error: fetchErr } = await supabase
        .from('submissions')
        .select('id, created_at, company, intent, utm_source, utm_medium, utm_campaign, utm_content, user_id, email')
        .gte('created_at', startISO)
        .lte('created_at', endISO)
        .order('created_at', { ascending: true })
        .range(from, from + PAGE - 1)
      if (fetchErr) return res.status(500).json({ error: fetchErr.message })
      submissions = submissions.concat(data || [])
      if (!data || data.length < PAGE) break
      from += PAGE
    }
  }
  const error = null

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

  // Helper to fetch all rows with pagination
  async function fetchAll(query) {
    let all = []
    let from = 0
    const PAGE = 1000
    while (true) {
      const { data } = await query.range(from, from + PAGE - 1)
      all = all.concat(data || [])
      if (!data || data.length < PAGE) break
      from += PAGE
    }
    return all
  }

  // Fetch job applications in date range
  let jobApps = []
  try {
    jobApps = await fetchAll(
      supabase.from('job_applications').select('id, created_at')
        .gte('created_at', startISO).lte('created_at', endISO)
    )
  } catch (e) {
    // table may not exist
  }

  // Fetch click events in date range
  let events = []
  try {
    events = await fetchAll(
      supabase.from('events').select('id, event, meta, created_at')
        .in('event', ['click_jobs_cta', 'click_job_card', 'view_jobs_page', 'view_job_detail', 'click_apply_button'])
        .gte('created_at', startISO).lte('created_at', endISO)
    )
  } catch (e) {
    // events table may not exist yet
  }

  // Fetch page_view events with UTM for campaign attribution (include view_jobs_page)
  let pageViews = []
  try {
    pageViews = await fetchAll(
      supabase.from('events').select('id, meta, created_at')
        .in('event', ['page_view', 'view_jobs_page'])
        .gte('created_at', startISO).lte('created_at', endISO)
    )
  } catch (e) {
    // events table may not exist yet
  }

  // Fetch landing events (all visitors)
  let landings = []
  try {
    landings = await fetchAll(
      supabase.from('events').select('id, created_at')
        .eq('event', 'landing')
        .gte('created_at', startISO).lte('created_at', endISO)
    )
  } catch (e) {
    // events table may not exist yet
  }

  // --- Aggregate daily trend ---
  const dailyMap = {}
  const newDay = () => ({ date: '', submissions: 0, ad: 0, organic: 0, signups: 0, companies: new Set(), jobApps: 0, jobClicks: 0, cardClicks: 0, jobsPageViews: 0, jobDetailViews: 0, applyClicks: 0, landings: 0 })
  for (const sub of submissions) {
    const date = sub.created_at.slice(0, 10)
    if (!dailyMap[date]) dailyMap[date] = { ...newDay(), date }
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
    if (!dailyMap[date]) dailyMap[date] = { ...newDay(), date }
    dailyMap[date].signups++
  }

  for (const ja of jobApps) {
    const date = ja.created_at.slice(0, 10)
    if (!dailyMap[date]) dailyMap[date] = { ...newDay(), date }
    dailyMap[date].jobApps++
  }

  for (const ev of events) {
    const date = ev.created_at.slice(0, 10)
    if (!dailyMap[date]) dailyMap[date] = { ...newDay(), date }
    if (ev.event === 'click_jobs_cta') dailyMap[date].jobClicks++
    if (ev.event === 'click_job_card') dailyMap[date].cardClicks++
    if (ev.event === 'view_jobs_page') dailyMap[date].jobsPageViews++
    if (ev.event === 'view_job_detail') dailyMap[date].jobDetailViews++
    if (ev.event === 'click_apply_button') dailyMap[date].applyClicks++
  }

  for (const l of landings) {
    const date = l.created_at.slice(0, 10)
    if (!dailyMap[date]) dailyMap[date] = { ...newDay(), date }
    dailyMap[date].landings++
  }

  const EVENT_TRACKING_START = '2026-05-06'

  // Fill in all dates in range (including dates with no data)
  const allDates = []
  {
    const cur = new Date(startDate + 'T00:00:00')
    const end = new Date(endDate + 'T00:00:00')
    while (cur <= end) {
      const key = cur.toISOString().slice(0, 10)
      allDates.push(key)
      cur.setDate(cur.getDate() + 1)
    }
  }
  for (const date of allDates) {
    if (!dailyMap[date]) {
      dailyMap[date] = { ...newDay(), date }
    }
  }

  const daily = Object.values(dailyMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({
      ...d,
      companies: d.companies instanceof Set ? d.companies.size : d.companies,
      landings: d.date < EVENT_TRACKING_START ? null : d.landings,
      jobClicks: d.date < EVENT_TRACKING_START ? null : d.jobClicks,
      cardClicks: d.date < EVENT_TRACKING_START ? null : d.cardClicks,
      jobsPageViews: d.date < EVENT_TRACKING_START ? null : d.jobsPageViews,
      jobDetailViews: d.date < EVENT_TRACKING_START ? null : d.jobDetailViews,
      applyClicks: d.date < EVENT_TRACKING_START ? null : d.applyClicks,
    }))

  // --- Intent breakdown ---
  const intentCounts = {}
  let preTracking = 0
  for (const sub of submissions) {
    if (!sub.intent) { preTracking++; continue }
    intentCounts[sub.intent] = (intentCounts[sub.intent] || 0) + 1
  }
  const intentLabels = lang === 'en' ? {
    open: 'Yes, available',
    selective: 'Open if right fit',
    none: 'Not right now',
    maybe_later: 'Maybe later',
    dismissed: 'Dismissed',
  } : {
    open: '적극 구직 중',
    selective: '맞는 곳이면 고려',
    none: '현재는 아님',
    maybe_later: '나중에 고려',
    dismissed: '관심 없음',
  }
  const preTrackingLabel = lang === 'en' ? 'Pre-tracking' : '추적 이전'
  const intent = Object.entries(intentCounts).map(([key, count]) => ({
    name: intentLabels[key] || key,
    value: count,
    pct: ((count / submissions.length) * 100).toFixed(1),
  }))
  intent.push({ name: preTrackingLabel, value: preTracking, pct: ((preTracking / submissions.length) * 100).toFixed(1) })

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
    totalJobApps: jobApps.length,
    totalLandings: landings.filter(l => l.created_at.slice(0, 10) >= EVENT_TRACKING_START).length,
    totalJobClicks: events.filter(e => e.event === 'click_jobs_cta' && e.created_at.slice(0, 10) >= EVENT_TRACKING_START).length,
    totalCardClicks: events.filter(e => e.event === 'click_job_card' && e.created_at.slice(0, 10) >= EVENT_TRACKING_START).length,
    totalJobsPageViews: events.filter(e => e.event === 'view_jobs_page' && e.created_at.slice(0, 10) >= EVENT_TRACKING_START).length,
    totalJobDetailViews: events.filter(e => e.event === 'view_job_detail' && e.created_at.slice(0, 10) >= EVENT_TRACKING_START).length,
    totalApplyClicks: events.filter(e => e.event === 'click_apply_button' && e.created_at.slice(0, 10) >= EVENT_TRACKING_START).length,
    hasEventTracking: endDate >= EVENT_TRACKING_START,
    eventTrackingStart: EVENT_TRACKING_START,
    uniqueCompanies: uniqueCompanies.size,
    interested,
    signupRate: submissions.length > 0 ? ((signups.length / submissions.length) * 100).toFixed(1) : '0',
  }

  // --- UTM breakdown (from page_view events + submissions) ---
  const utmBreakdown = { bySource: {}, byCampaign: {}, byContent: {} }

  // Count page views by UTM dimensions
  for (const pv of pageViews) {
    const m = pv.meta || {}
    if (m.utm_source) {
      utmBreakdown.bySource[m.utm_source] = utmBreakdown.bySource[m.utm_source] || { views: 0, submissions: 0 }
      utmBreakdown.bySource[m.utm_source].views++
    }
    if (m.utm_campaign) {
      utmBreakdown.byCampaign[m.utm_campaign] = utmBreakdown.byCampaign[m.utm_campaign] || { views: 0, submissions: 0 }
      utmBreakdown.byCampaign[m.utm_campaign].views++
    }
    if (m.utm_content) {
      utmBreakdown.byContent[m.utm_content] = utmBreakdown.byContent[m.utm_content] || { views: 0, submissions: 0 }
      utmBreakdown.byContent[m.utm_content].views++
    }
  }

  // Count submissions by UTM dimensions
  for (const sub of submissions) {
    if (sub.utm_source) {
      utmBreakdown.bySource[sub.utm_source] = utmBreakdown.bySource[sub.utm_source] || { views: 0, submissions: 0 }
      utmBreakdown.bySource[sub.utm_source].submissions++
    }
    if (sub.utm_campaign) {
      utmBreakdown.byCampaign[sub.utm_campaign] = utmBreakdown.byCampaign[sub.utm_campaign] || { views: 0, submissions: 0 }
      utmBreakdown.byCampaign[sub.utm_campaign].submissions++
    }
    if (sub.utm_content) {
      utmBreakdown.byContent[sub.utm_content] = utmBreakdown.byContent[sub.utm_content] || { views: 0, submissions: 0 }
      utmBreakdown.byContent[sub.utm_content].submissions++
    }
  }

  // Convert to sorted arrays
  const toSorted = (obj) => Object.entries(obj)
    .map(([name, d]) => ({ name, views: d.views, submissions: d.submissions, convRate: d.views > 0 ? ((d.submissions / d.views) * 100).toFixed(1) : '-' }))
    .sort((a, b) => b.views - a.views)

  // Daily views per campaign (for trend chart in UTM tab)
  const dailyCampaignMap = {}
  for (const pv of pageViews) {
    const campaign = pv.meta?.utm_campaign
    if (!campaign) continue
    const date = pv.created_at.slice(0, 10)
    if (!dailyCampaignMap[campaign]) dailyCampaignMap[campaign] = {}
    dailyCampaignMap[campaign][date] = (dailyCampaignMap[campaign][date] || 0) + 1
  }
  const dailyByCampaign = Object.entries(dailyCampaignMap).map(([name, dates]) => ({
    name,
    daily: Object.entries(dates).sort((a, b) => a[0].localeCompare(b[0])).map(([date, views]) => ({ date, views })),
  }))

  const utm = {
    bySource: toSorted(utmBreakdown.bySource),
    byCampaign: toSorted(utmBreakdown.byCampaign),
    byContent: toSorted(utmBreakdown.byContent),
    dailyByCampaign,
    totalPageViews: pageViews.length,
  }

  res.json({ summary, daily, intent, topCompanies, utm })
}
