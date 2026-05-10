import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from './check'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  const user = await verifyAdmin(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const now = new Date()
  const vn = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  const today = vn.toISOString().slice(0, 10)
  const startISO = new Date(`${today}T00:00:00+07:00`).toISOString()
  const endISO = new Date(`${today}T23:59:59+07:00`).toISOString()

  const [subsRes, jaRes, evRes, pvRes, landingRes] = await Promise.all([
    supabase.from('submissions')
      .select('id, utm_source, utm_medium, utm_campaign', { count: 'exact', head: false })
      .gte('created_at', startISO).lte('created_at', endISO)
      .limit(10000),
    supabase.from('job_applications')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startISO).lte('created_at', endISO),
    supabase.from('events')
      .select('id, event')
      .in('event', ['click_jobs_cta', 'click_job_card'])
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
  ])

  const subs = subsRes.data || []
  const events = evRes.data || []

  let todaySignups = 0
  try {
    let page = 1
    while (true) {
      const { data: { users }, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
      if (error || !users || users.length === 0) break
      todaySignups += users.filter(u => u.created_at >= startISO && u.created_at <= endISO).length
      if (users.length < 1000) break
      page++
    }
  } catch (e) {}

  const ad = subs.filter(s => s.utm_source || s.utm_medium || s.utm_campaign).length

  res.json({
    date: today,
    submissions: subs.length,
    ad,
    organic: subs.length - ad,
    signups: todaySignups,
    jobApps: jaRes.count || 0,
    jobClicks: events.filter(e => e.event === 'click_jobs_cta').length,
    cardClicks: events.filter(e => e.event === 'click_job_card').length,
    pageViews: pvRes.count || 0,
    landings: landingRes.count || 0,
  })
}
