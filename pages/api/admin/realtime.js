import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from './check'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Exclude internal/seed/system accounts and banned users from signup counts
const EXCLUDED_EMAIL_DOMAINS = ['likelion.net', 'dummy.local', 'system.local']
function isExcludedSignup(user) {
  if (user.email && EXCLUDED_EMAIL_DOMAINS.some(d => user.email.endsWith('@' + d))) return true
  if (user.banned_until && new Date(user.banned_until) > new Date()) return true
  return false
}

export default async function handler(req, res) {
  const user = await verifyAdmin(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const now = new Date()
  const vn = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  const today = vn.toISOString().slice(0, 10)
  const startISO = new Date(`${today}T00:00:00+07:00`).toISOString()
  const endISO = new Date(`${today}T23:59:59+07:00`).toISOString()

  const [subsRes, jaRes, evRes, pvRes, landingRes, resumeRes, csRes] = await Promise.all([
    supabase.from('submissions')
      .select('id, utm_source, utm_medium, utm_campaign', { count: 'exact', head: false })
      .gte('created_at', startISO).lte('created_at', endISO)
      .limit(10000),
    supabase.from('job_applications')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startISO).lte('created_at', endISO),
    supabase.from('events')
      .select('id, event')
      .in('event', ['click_jobs_cta', 'click_job_card', 'view_jobs_page', 'click_apply_button', 'save_job', 'click_for_companies', 'click_contact_owner', 'click_post_job'])
      .gte('created_at', startISO).lte('created_at', endISO)
      .limit(10000),
    supabase.from('events')
      .select('id', { count: 'exact', head: true })
      .eq('event', 'page_view')
      .gte('created_at', startISO).lte('created_at', endISO),
    supabase.from('events')
      .select('id', { count: 'exact', head: true })
      .eq('event', 'landing')
      .gte('created_at', startISO).lte('created_at', endISO),
    supabase.from('events')
      .select('id', { count: 'exact', head: true })
      .eq('event', 'resume_upload')
      .gte('created_at', startISO).lte('created_at', endISO),
    supabase.from('recruiter_users')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startISO).lte('created_at', endISO),
  ])

  const subs = subsRes.data || []
  const events = evRes.data || []

  let todaySignups = 0
  try {
    let page = 1
    while (true) {
      const { data: { users }, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
      if (error || !users || users.length === 0) break
      todaySignups += users.filter(u => u.created_at >= startISO && u.created_at <= endISO && !isExcludedSignup(u)).length
      if (users.length < 1000) break
      page++
    }
  } catch (e) {}

  const ad = subs.filter(s => s.utm_source || s.utm_medium || s.utm_campaign).length
  const evCount = (name) => events.filter(e => e.event === name).length

  res.json({
    date: today,
    submissions: subs.length,
    ad,
    organic: subs.length - ad,
    signups: todaySignups,
    jobApps: jaRes.count || 0,
    jobClicks: evCount('click_jobs_cta'),
    cardClicks: evCount('click_job_card'),
    jobsPageViews: evCount('view_jobs_page'),
    applyClicks: evCount('click_apply_button'),
    saveClicks: evCount('save_job'),
    forCompaniesClicks: evCount('click_for_companies'),
    contactClicks: evCount('click_contact_owner'),
    postJobClicks: evCount('click_post_job'),
    companySignups: csRes.count || 0,
    pageViews: pvRes.count || 0,
    landings: landingRes.count || 0,
    resumeUploads: resumeRes.count || 0,
  })
}
