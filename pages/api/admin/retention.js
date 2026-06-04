import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from './check'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const EXCLUDED_EMAIL_DOMAINS = ['likelion.net', 'dummy.local', 'system.local']

function isExcluded(user) {
  if (user.email && EXCLUDED_EMAIL_DOMAINS.some(d => user.email.endsWith('@' + d))) return true
  // Banned/deactivated auth users (e.g. seed system account)
  if (user.banned_until && new Date(user.banned_until) > new Date()) return true
  return false
}

export default async function handler(req, res) {
  const admin = await verifyAdmin(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  try {
    // Fetch all users
    let allUsers = []
    let page = 1
    while (true) {
      const { data: { users }, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
      if (error || !users || users.length === 0) break
      allUsers = allUsers.concat(users)
      if (users.length < 1000) break
      page++
    }

    allUsers = allUsers.filter(u => !isExcluded(u))

    const now = Date.now()
    const DAY = 86400000

    // Calculate D1, D7, D30 retention
    // D(N) retention = users who signed up >= N days ago AND last_sign_in_at is >= N days after created_at
    function calcRetention(days) {
      const eligible = allUsers.filter(u => {
        const created = new Date(u.created_at).getTime()
        return (now - created) >= days * DAY
      })
      const retained = eligible.filter(u => {
        if (!u.last_sign_in_at) return false
        const created = new Date(u.created_at).getTime()
        const lastSignIn = new Date(u.last_sign_in_at).getTime()
        return (lastSignIn - created) >= days * DAY
      })
      return {
        eligible: eligible.length,
        retained: retained.length,
        rate: eligible.length > 0 ? ((retained.length / eligible.length) * 100).toFixed(1) : '0',
      }
    }

    const d1 = calcRetention(1)
    const d7 = calcRetention(7)
    const d30 = calcRetention(30)

    // Weekly cohort retention table
    // Group users by signup week (Monday-based)
    const cohorts = {}
    for (const u of allUsers) {
      const created = new Date(u.created_at)
      const day = created.getDay()
      const mon = new Date(created)
      mon.setDate(created.getDate() - ((day + 6) % 7))
      const weekKey = mon.toISOString().slice(0, 10)

      if (!cohorts[weekKey]) cohorts[weekKey] = { week: weekKey, users: [] }
      cohorts[weekKey].users.push({
        created_at: created.getTime(),
        last_sign_in_at: u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : null,
      })
    }

    const cohortData = Object.values(cohorts)
      .sort((a, b) => a.week.localeCompare(b.week))
      .map(c => {
        const total = c.users.length
        // Calculate retention for week 1, 2, 3, 4
        const weeks = [1, 2, 3, 4].map(w => {
          const daysNeeded = w * 7
          const eligible = c.users.filter(u => (now - u.created_at) >= daysNeeded * DAY)
          const retained = eligible.filter(u => u.last_sign_in_at && (u.last_sign_in_at - u.created_at) >= daysNeeded * DAY)
          if (eligible.length === 0) return null
          return {
            eligible: eligible.length,
            retained: retained.length,
            rate: ((retained.length / eligible.length) * 100).toFixed(1),
          }
        })
        return { week: c.week, total, weeks }
      })

    // Active users summary
    const activeIn7d = allUsers.filter(u => u.last_sign_in_at && (now - new Date(u.last_sign_in_at).getTime()) < 7 * DAY).length
    const activeIn30d = allUsers.filter(u => u.last_sign_in_at && (now - new Date(u.last_sign_in_at).getTime()) < 30 * DAY).length

    res.json({
      totalUsers: allUsers.length,
      activeIn7d,
      activeIn30d,
      d1,
      d7,
      d30,
      cohorts: cohortData,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
