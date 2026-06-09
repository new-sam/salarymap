import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from './check'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// --- Data quality filters ---
const EXCLUDED_COMPANIES = new Set([
  'likelion', 'likelion vn', 'likelion vietnam',
  '{company}', 'dwqdqwd', 'gggg', 'kkk', 'xx', 'yy', 'tt', 'xd', 'blah', 'idk',
  'úud', 'ừv', 'khôbg', 'bcagnecu', 'hi', 'boo', 'cac', 'say gex', '12',
  'alice testing', 'alice testing 2', 'jobtest', '...', 'bimat', 'bí mật',
  'secret', 'cant say', 'ẩn danh', 'tên công ty được giữ ẩn danh',
  'anonymous', 'hide', 'm*',
])
const EXCLUDED_EMAIL_DOMAINS = ['likelion.net', 'dummy.local', 'system.local']

// Banned/deactivated auth users (e.g. seed system account) should not count as signups
function isBannedUser(user) {
  return user.banned_until && new Date(user.banned_until) > new Date()
}

function isExcludedSubmission(sub) {
  if (sub.company && EXCLUDED_COMPANIES.has(sub.company.trim().toLowerCase())) return true
  if (sub.email && EXCLUDED_EMAIL_DOMAINS.some(d => sub.email.endsWith('@' + d))) return true
  return false
}

function dedupeSubmissions(subs) {
  const seen = new Set()
  return subs.filter(s => {
    if (!s.user_id || !s.company) return true
    const key = s.user_id + '::' + s.company.trim().toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function isExcludedSignup(user) {
  if (user.email && EXCLUDED_EMAIL_DOMAINS.some(d => user.email.endsWith('@' + d))) return true
  if (isBannedUser(user)) return true
  return false
}

export default async function handler(req, res) {
  const user = await verifyAdmin(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { from, to, lang } = req.query
  const startDate = from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const endDate = to || new Date().toISOString().slice(0, 10)

  const startISO = `${startDate}T00:00:00`
  const endISO = `${endDate}T23:59:59`

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

  const toVN = (iso) => new Date(new Date(iso).getTime() + 7 * 3600000).toISOString().slice(0, 10)
  const EVENT_NAMES = ['click_jobs_cta', 'click_job_card', 'view_jobs_page', 'click_apply_button', 'save_job', 'click_for_companies', 'click_contact_owner', 'click_post_job', 'landing']

  // 모든 쿼리 병렬 실행. 이벤트는 DB에서 집계(RPC)해 수만 행 전송을 없앰. (직렬 await → Promise.all)
  const [submissionsRaw, signups, jobApps, eventDaily, utmPv, resumeUsers, companySignups, pendingJobs] = await Promise.all([
    // submissions (페이지네이션)
    fetchAll(
      supabase.from('submissions')
        .select('id, created_at, company, intent, utm_source, utm_medium, utm_campaign, utm_content, user_id, email')
        .gte('created_at', startISO).lte('created_at', endISO)
        .order('created_at', { ascending: true })
    ).catch(() => []),
    // sign-ups (auth.users admin API — 전체 페이지)
    (async () => {
      try {
        let page = 1, allUsers = []
        while (true) {
          const { data: { users }, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
          if (error || !users || users.length === 0) break
          allUsers = allUsers.concat(users)
          if (users.length < 1000) break
          page++
        }
        return allUsers.filter(u => u.created_at >= startISO && u.created_at <= endISO && !isExcludedSignup(u))
      } catch (e) { return [] }
    })(),
    // job applications
    fetchAll(supabase.from('job_applications').select('id, created_at')
      .gte('created_at', startISO).lte('created_at', endISO)).catch(() => []),
    // 이벤트 일별 카운트 — DB 집계 RPC (실패 시 행 fetch 폴백)
    (async () => {
      try {
        const { data, error } = await supabase.rpc('admin_event_daily', { p_start: startISO, p_end: endISO })
        if (error) throw error
        return (data || []).map(r => ({ d: r.d, event: r.event, cnt: Number(r.cnt) }))
      } catch (e) {
        const rows = await fetchAll(supabase.from('events').select('event, created_at')
          .in('event', EVENT_NAMES).gte('created_at', startISO).lte('created_at', endISO)).catch(() => [])
        const m = {}
        for (const r of rows) { const k = toVN(r.created_at) + '|' + r.event; m[k] = (m[k] || 0) + 1 }
        return Object.entries(m).map(([k, cnt]) => ({ d: k.slice(0, k.indexOf('|')), event: k.slice(k.indexOf('|') + 1), cnt }))
      }
    })(),
    // UTM 차원별 page_view 카운트 — DB 집계 RPC (실패 시 행 fetch 폴백)
    (async () => {
      try {
        const { data, error } = await supabase.rpc('admin_utm_pageviews', { p_start: startISO, p_end: endISO })
        if (error) throw error
        return (data || []).map(r => ({ d: r.d, utm_source: r.utm_source, utm_campaign: r.utm_campaign, utm_content: r.utm_content, cnt: Number(r.cnt) }))
      } catch (e) {
        const rows = await fetchAll(supabase.from('events').select('meta, created_at')
          .in('event', ['page_view', 'view_jobs_page']).gte('created_at', startISO).lte('created_at', endISO)).catch(() => [])
        const m = {}
        for (const r of rows) { const mt = r.meta || {}; const d = toVN(r.created_at); const k = d + '|' + (mt.utm_source || '') + '|' + (mt.utm_campaign || '') + '|' + (mt.utm_content || ''); if (!m[k]) m[k] = { d, s: mt.utm_source, c: mt.utm_campaign, ct: mt.utm_content, n: 0 }; m[k].n++ }
        return Object.values(m).map(x => ({ d: x.d, utm_source: x.s, utm_campaign: x.c, utm_content: x.ct, cnt: x.n }))
      }
    })(),
    // resume users (이력서 보유)
    (async () => {
      try {
        const { data } = await supabase.from('user_profiles').select('id, updated_at').not('resume_url', 'is', null)
        return (data || []).filter(r => r.updated_at)
      } catch (e) { return [] }
    })(),
    // company (recruiter) signups — 기업 가입자
    fetchAll(supabase.from('recruiter_users').select('id, created_at')
      .gte('created_at', startISO).lte('created_at', endISO)).catch(() => []),
    // 공고 승인 대기 현황 (현재 pending_review 수)
    (async () => {
      try {
        const { count } = await supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'pending_review')
        return count || 0
      } catch (e) { return 0 }
    })(),
  ])

  // Apply data quality filters: exclude internal/garbage entries and dedupe
  const submissions = dedupeSubmissions(submissionsRaw.filter(s => !isExcludedSubmission(s)))

  // --- Aggregate daily trend ---
  const dailyMap = {}
  const newDay = () => ({ date: '', submissions: 0, ad: 0, organic: 0, signups: 0, companies: new Set(), jobApps: 0, jobClicks: 0, cardClicks: 0, jobsPageViews: 0, applyClicks: 0, saveClicks: 0, resumeUploads: 0, landings: 0, forCompaniesClicks: 0, contactClicks: 0, postJobClicks: 0, companySignups: 0 })
  for (const sub of submissions) {
    const date = toVN(sub.created_at)
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
    const date = toVN(s.created_at)
    if (!dailyMap[date]) dailyMap[date] = { ...newDay(), date }
    dailyMap[date].signups++
  }

  for (const ja of jobApps) {
    const date = toVN(ja.created_at)
    if (!dailyMap[date]) dailyMap[date] = { ...newDay(), date }
    dailyMap[date].jobApps++
  }

  const EVENT_FIELD = { click_jobs_cta: 'jobClicks', click_job_card: 'cardClicks', view_jobs_page: 'jobsPageViews', click_apply_button: 'applyClicks', save_job: 'saveClicks', click_for_companies: 'forCompaniesClicks', click_contact_owner: 'contactClicks', click_post_job: 'postJobClicks', landing: 'landings' }
  for (const r of eventDaily) {
    const date = r.d
    if (!dailyMap[date]) dailyMap[date] = { ...newDay(), date }
    const field = EVENT_FIELD[r.event]
    if (field) dailyMap[date][field] += r.cnt
  }

  for (const cs of companySignups) {
    const date = toVN(cs.created_at)
    if (!dailyMap[date]) dailyMap[date] = { ...newDay(), date }
    dailyMap[date].companySignups++
  }

  for (const ru of resumeUsers) {
    const date = toVN(ru.updated_at)
    if (!dailyMap[date]) dailyMap[date] = { ...newDay(), date }
    dailyMap[date].resumeUploads++
  }

  const EVENT_TRACKING_START = '2026-05-06'
  // 이벤트 일별집계(eventDaily) 합으로 요약 카운트 (날짜는 VN기준, gate 이후만)
  const evtSum = (event, gate = EVENT_TRACKING_START) => eventDaily.filter(r => r.event === event && r.d >= gate).reduce((a, r) => a + r.cnt, 0)

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
      applyClicks: d.date < EVENT_TRACKING_START ? null : d.applyClicks,
      saveClicks: d.date < '2026-05-11' ? null : d.saveClicks,
      resumeUploads: d.date < '2026-05-19' ? null : d.resumeUploads,
      forCompaniesClicks: d.date < EVENT_TRACKING_START ? null : d.forCompaniesClicks,
      contactClicks: d.date < EVENT_TRACKING_START ? null : d.contactClicks,
      postJobClicks: d.date < EVENT_TRACKING_START ? null : d.postJobClicks,
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
    totalLandings: evtSum('landing'),
    totalJobClicks: evtSum('click_jobs_cta'),
    totalCardClicks: evtSum('click_job_card'),
    totalJobsPageViews: evtSum('view_jobs_page'),
    totalApplyClicks: evtSum('click_apply_button'),
    totalSaveClicks: evtSum('save_job', '2026-05-11'),
    totalResumeUploads: resumeUsers.length,
    totalForCompaniesClicks: evtSum('click_for_companies'),
    totalContactOwnerClicks: evtSum('click_contact_owner'),
    totalPostJobClicks: evtSum('click_post_job'),
    totalCompanySignups: companySignups.length,
    pendingJobs,
    hasEventTracking: endDate >= EVENT_TRACKING_START,
    eventTrackingStart: EVENT_TRACKING_START,
    uniqueCompanies: uniqueCompanies.size,
    interested,
    signupRate: submissions.length > 0 ? ((signups.length / submissions.length) * 100).toFixed(1) : '0',
  }

  // --- UTM breakdown (from page_view events + submissions) ---
  const utmBreakdown = { bySource: {}, byCampaign: {}, byContent: {} }

  // Count page views by UTM dimensions
  for (const pv of utmPv) {
    if (pv.utm_source) {
      utmBreakdown.bySource[pv.utm_source] = utmBreakdown.bySource[pv.utm_source] || { views: 0, submissions: 0 }
      utmBreakdown.bySource[pv.utm_source].views += pv.cnt
    }
    if (pv.utm_campaign) {
      utmBreakdown.byCampaign[pv.utm_campaign] = utmBreakdown.byCampaign[pv.utm_campaign] || { views: 0, submissions: 0 }
      utmBreakdown.byCampaign[pv.utm_campaign].views += pv.cnt
    }
    if (pv.utm_content) {
      utmBreakdown.byContent[pv.utm_content] = utmBreakdown.byContent[pv.utm_content] || { views: 0, submissions: 0 }
      utmBreakdown.byContent[pv.utm_content].views += pv.cnt
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
  for (const pv of utmPv) {
    if (!pv.utm_campaign) continue
    if (!dailyCampaignMap[pv.utm_campaign]) dailyCampaignMap[pv.utm_campaign] = {}
    dailyCampaignMap[pv.utm_campaign][pv.d] = (dailyCampaignMap[pv.utm_campaign][pv.d] || 0) + pv.cnt
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
    totalPageViews: utmPv.reduce((a, r) => a + r.cnt, 0),
  }

  res.json({ summary, daily, intent, topCompanies, utm })
}
