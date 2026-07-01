// One-off analytics for FYI monetization thesis. Read-only.
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const EXCLUDED_EMAIL_DOMAINS = ['likelion.net', 'dummy.local', 'system.local']

async function fetchAll(makeQuery) {
  let all = []
  let from = 0
  const PAGE = 1000
  while (true) {
    const { data, error } = await makeQuery().range(from, from + PAGE - 1)
    if (error) { console.error('fetchAll error:', error.message); break }
    all = all.concat(data || [])
    if (!data || data.length < PAGE) break
    from += PAGE
  }
  return all
}

async function getRealAuthUsers() {
  const users = []
  const internal = new Set()
  let page = 1
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) { console.error('listUsers error:', error.message); break }
    const list = data?.users || []
    if (list.length === 0) break
    for (const u of list) {
      const banned = u.banned_until && new Date(u.banned_until) > new Date()
      const isInternal = u.email && EXCLUDED_EMAIL_DOMAINS.some(d => u.email.endsWith('@' + d))
      if (banned || isInternal) { internal.add(u.id); continue }
      users.push({ id: u.id, email: u.email, created_at: u.created_at })
    }
    if (list.length < 1000) break
    page++
  }
  return { users, internal }
}

function daysAgoISO(n) {
  const ms = Date.now() - n * 24 * 60 * 60 * 1000
  return new Date(ms).toISOString()
}

async function main() {
  const out = {}

  // 1. Real auth users
  const { users: authUsers, internal } = await getRealAuthUsers()
  const realIds = new Set(authUsers.map(u => u.id))
  out.totalRealUsers = authUsers.length
  out.internalExcluded = internal.size

  // signups last 30 / 7 days
  const now = Date.now()
  const d30 = now - 30 * 864e5
  const d7 = now - 7 * 864e5
  out.signups30d = authUsers.filter(u => new Date(u.created_at).getTime() >= d30).length
  out.signups7d = authUsers.filter(u => new Date(u.created_at).getTime() >= d7).length

  // 2. Resume registration
  const profiles = await fetchAll(() => supabase
    .from('user_profiles')
    .select('id, resume_url, is_resume_public, resume_source, resume_platform, verified_company_name'))
  const realProfiles = profiles.filter(p => realIds.has(p.id))
  const withResume = realProfiles.filter(p => p.resume_url)
  out.profilesTotal = realProfiles.length
  out.resumeSubmitted = withResume.length
  out.resumePublic = realProfiles.filter(p => p.is_resume_public).length
  out.resumeSourceBreakdown = withResume.reduce((m, p) => {
    const k = p.resume_source || 'unknown'; m[k] = (m[k] || 0) + 1; return m
  }, {})
  out.resumePlatformBreakdown = withResume.reduce((m, p) => {
    const k = p.resume_platform || 'unknown'; m[k] = (m[k] || 0) + 1; return m
  }, {})
  out.verifiedWorkers = realProfiles.filter(p => p.verified_company_name).length

  // 3. Community posting (excl seed/system)
  const posts = await fetchAll(() => supabase
    .from('community_posts')
    .select('id, user_id, author_name, created_at, view_count'))
  const comments = await fetchAll(() => supabase
    .from('community_comments')
    .select('id, user_id, author_name, created_at'))
  const realPosts = posts.filter(p => realIds.has(p.user_id))
  const realComments = comments.filter(c => realIds.has(c.user_id))
  out.postsTotalAll = posts.length
  out.postsReal = realPosts.length
  out.commentsReal = realComments.length
  const writers = new Set([...realPosts.map(p => p.user_id), ...realComments.map(c => c.user_id)])
  out.uniqueWritersEver = writers.size

  // 4. Active users / lurker ratio (events, last 30 days, real users only)
  const events = await fetchAll(() => supabase
    .from('events')
    .select('user_id, event, created_at')
    .not('user_id', 'is', null)
    .gte('created_at', daysAgoISO(30)))
  const activeUsers = new Set(events.filter(e => realIds.has(e.user_id)).map(e => e.user_id))
  const communityViewEvents = events.filter(e =>
    realIds.has(e.user_id) &&
    (e.event === 'view_community' || e.event === 'view_community_post'))
  const communityViewers = new Set(communityViewEvents.map(e => e.user_id))
  const writers30 = new Set([
    ...realPosts.filter(p => new Date(p.created_at).getTime() >= d30).map(p => p.user_id),
    ...realComments.filter(c => new Date(c.created_at).getTime() >= d30).map(c => c.user_id),
  ])
  out.activeUsers30d = activeUsers.size
  out.communityViewers30d = communityViewers.size
  out.writers30d = writers30.size
  out.communityLurkers30d = communityViewers.size - [...communityViewers].filter(id => writers30.has(id)).length
  out.lurkerRatioOfViewers = communityViewers.size
    ? +(1 - writers30.size / communityViewers.size).toFixed(3) : null

  // 5. Cross: do resume-holders overlap with lurkers? (thesis: they register resume but don't post)
  const resumeHolderIds = new Set(withResume.map(p => p.id))
  const resumeHoldersWhoPost = [...resumeHolderIds].filter(id => writers.has(id)).length
  out.resumeHolders = resumeHolderIds.size
  out.resumeHoldersWhoPostedEver = resumeHoldersWhoPost
  out.resumeHoldersWhoNeverPosted = resumeHolderIds.size - resumeHoldersWhoPost

  // 6. Salary submissions (real, non-seed)
  const subs = await fetchAll(() => supabase
    .from('submissions')
    .select('id, user_id, company, is_seed, created_at'))
  const realSubs = subs.filter(s => !s.is_seed && (!s.user_id || realIds.has(s.user_id)))
  out.salarySubmissions = realSubs.length

  // 7. Job applications
  const apps = await fetchAll(() => supabase
    .from('job_applications')
    .select('id, user_id, application_source, created_at'))
  out.jobApplications = apps.filter(a => !a.user_id || realIds.has(a.user_id)).length

  console.log(JSON.stringify(out, null, 2))
}

main().catch(e => { console.error(e); process.exit(1) })
