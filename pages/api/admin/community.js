import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from './check'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Exclude internal / seed / banned accounts so the dashboard reflects real users.
const EXCLUDED_EMAIL_DOMAINS = ['likelion.net', 'dummy.local', 'system.local']

export default async function handler(req, res) {
  const user = await verifyAdmin(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { from, to } = req.query
  const startDate = from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const endDate = to || new Date().toISOString().slice(0, 10)
  const startISO = `${startDate}T00:00:00`
  const endISO = `${endDate}T23:59:59`

  // Generic paginated fetch (Supabase caps at 1000 rows/request)
  async function fetchAll(buildQuery) {
    let all = []
    let offset = 0
    const PAGE = 1000
    while (true) {
      const { data, error } = await buildQuery(offset, offset + PAGE - 1)
      if (error) break
      all = all.concat(data || [])
      if (!data || data.length < PAGE) break
      offset += PAGE
    }
    return all
  }

  // Build the set of user_ids to exclude (internal domains + banned/seed accounts)
  const excludedUserIds = new Set()
  try {
    let page = 1
    while (true) {
      const { data: { users }, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
      if (error || !users || users.length === 0) break
      for (const u of users) {
        const banned = u.banned_until && new Date(u.banned_until) > new Date()
        const internal = u.email && EXCLUDED_EMAIL_DOMAINS.some(d => u.email.endsWith('@' + d))
        if (banned || internal) excludedUserIds.add(u.id)
      }
      if (users.length < 1000) break
      page++
    }
  } catch (e) {
    // admin API unavailable — fall back to counting everyone
  }
  const keep = (uid) => !excludedUserIds.has(uid)

  // --- Domain tables (accurate, range-filterable by created_at) ---
  const posts = (await fetchAll((a, b) => supabase
    .from('community_posts')
    .select('id, user_id, author_name, category, title, like_count, comment_count, view_count, is_anonymous, created_at')
    .gte('created_at', startISO).lte('created_at', endISO)
    .order('created_at', { ascending: true })
    .range(a, b)
  )).filter(p => keep(p.user_id))

  const comments = (await fetchAll((a, b) => supabase
    .from('community_comments')
    .select('id, user_id, post_id, created_at')
    .gte('created_at', startISO).lte('created_at', endISO)
    .range(a, b)
  )).filter(c => keep(c.user_id))

  const likes = (await fetchAll((a, b) => supabase
    .from('community_likes')
    .select('id, user_id, post_id, created_at')
    .gte('created_at', startISO).lte('created_at', endISO)
    .range(a, b)
  )).filter(l => keep(l.user_id))

  // --- Soft funnel events ---
  let events = []
  try {
    events = await fetchAll((a, b) => supabase
      .from('events')
      .select('event, meta, created_at')
      .in('event', ['view_community', 'view_community_post', 'click_community_write', 'click_community_post', 'click_community_nav', 'click_community_tab'])
      .gte('created_at', startISO).lte('created_at', endISO)
      .range(a, b)
    )
  } catch (e) {
    // events table may not exist yet
  }

  // --- Daily aggregation (VN timezone, matching the rest of the dashboard) ---
  const toVN = (iso) => new Date(new Date(iso).getTime() + 7 * 3600000).toISOString().slice(0, 10)
  const dailyMap = {}
  const newDay = (date) => ({ date, posts: 0, comments: 0, likes: 0, listViews: 0, postViews: 0, writeClicks: 0, navClicks: 0 })
  const bump = (iso, key) => {
    const date = toVN(iso)
    if (!dailyMap[date]) dailyMap[date] = newDay(date)
    dailyMap[date][key]++
  }
  posts.forEach(p => bump(p.created_at, 'posts'))
  comments.forEach(c => bump(c.created_at, 'comments'))
  likes.forEach(l => bump(l.created_at, 'likes'))
  events.forEach(e => {
    if (e.event === 'view_community') bump(e.created_at, 'listViews')
    else if (e.event === 'view_community_post') bump(e.created_at, 'postViews')
    else if (e.event === 'click_community_write') bump(e.created_at, 'writeClicks')
    else if (e.event === 'click_community_nav' || e.event === 'click_community_tab') bump(e.created_at, 'navClicks')
  })

  // Fill gaps only within the active window (skip pre-launch empty dates)
  {
    const activeDates = Object.keys(dailyMap).sort()
    if (activeDates.length) {
      const cur = new Date(activeDates[0] + 'T00:00:00')
      const end = new Date(activeDates[activeDates.length - 1] + 'T00:00:00')
      while (cur <= end) {
        const key = cur.toISOString().slice(0, 10)
        if (!dailyMap[key]) dailyMap[key] = newDay(key)
        cur.setDate(cur.getDate() + 1)
      }
    }
  }
  const daily = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date))

  // --- Category breakdown ---
  const catMap = {}
  posts.forEach(p => { catMap[p.category] = (catMap[p.category] || 0) + 1 })
  const byCategory = Object.entries(catMap)
    .map(([key, count]) => ({ key, posts: count }))
    .sort((a, b) => b.posts - a.posts)

  // --- Top posts by engagement (likes + comments), all-time counts on the post ---
  const topPosts = [...posts]
    .sort((a, b) => (b.like_count + b.comment_count) - (a.like_count + a.comment_count))
    .slice(0, 20)
    .map(p => ({
      id: p.id, title: p.title, category: p.category, is_anonymous: p.is_anonymous,
      author_name: p.author_name, like_count: p.like_count, comment_count: p.comment_count,
      view_count: p.view_count, created_at: p.created_at,
    }))

  // Unique people who posted or commented (engagement breadth, identity-agnostic)
  const authorSet = new Set()
  posts.forEach(p => authorSet.add(p.user_id))
  comments.forEach(c => authorSet.add(c.user_id))

  const listViews = events.filter(e => e.event === 'view_community').length
  const navClicks = events.filter(e => e.event === 'click_community_nav' || e.event === 'click_community_tab').length
  const postClicks = events.filter(e => e.event === 'click_community_post').length
  const writeClicks = events.filter(e => e.event === 'click_community_write').length

  const summary = {
    totalPosts: posts.length,
    totalComments: comments.length,
    totalLikes: likes.length,
    uniqueAuthors: authorSet.size,
    postViews: events.filter(e => e.event === 'view_community_post').length,
    listViews,
    writeClicks,
    navClicks,
    avgCommentsPerPost: posts.length ? (comments.length / posts.length).toFixed(1) : '0',
    hasEventTracking: events.length > 0,
  }

  // --- Entry funnel: tab/nav click → list view → post click / write / create ---
  // Consumption & creation both branch from the list view, so rates use listViews as base.
  const pct = (n, d) => (d > 0 ? +((n / d) * 100).toFixed(1) : null)
  const funnel = {
    navClicks,
    listViews,
    postClicks,
    writeClicks,
    created: posts.length,
    navToList: pct(listViews, navClicks),   // share of arrivals reached via the nav/tab
    postRate: pct(postClicks, listViews),   // list → opened a post
    writeRate: pct(writeClicks, listViews), // list → clicked write
    createRate: pct(posts.length, listViews), // list → actually posted
  }

  res.json({ summary, daily, byCategory, topPosts, funnel })
}
