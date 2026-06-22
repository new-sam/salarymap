import supabase from '../../../lib/supabaseAdmin'
import { earnedEngagementKeys } from '../../../lib/engagementBadges'

// 베트남(UTC+7) 기준 오늘 'YYYY-MM-DD'.
function vnDay() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
}
function prevDay(d) {
  const t = new Date(d + 'T00:00:00Z')
  t.setUTCDate(t.getUTCDate() - 1)
  return t.toISOString().slice(0, 10)
}
// 오늘(없으면 어제)부터 거꾸로 연속된 출석일 수.
function computeStreak(daysDesc) {
  const set = new Set((daysDesc || []).map(r => r.day))
  let cur = vnDay()
  if (!set.has(cur)) {
    cur = prevDay(cur)
    if (!set.has(cur)) return 0
  }
  let streak = 0
  while (set.has(cur)) {
    streak++
    cur = prevDay(cur)
  }
  return streak
}
const sum = (rows, col) => (rows || []).reduce((a, r) => a + (r[col] || 0), 0)

// GET /api/badges/engagement — 참여형 뱃지용 실시간 카운트 + 출석 streak.
// 달성한 참여형 뱃지는 user_badges에 영구 부여(lazy grant)해 대표 선택/커뮤니티 노출에 쓰게 한다.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })
  const uid = user.id

  const head = { count: 'exact', head: true }
  const [posts, comments, likesGiven, applications, myPosts, myComments, days] = await Promise.all([
    supabase.from('community_posts').select('*', head).eq('user_id', uid),
    supabase.from('community_comments').select('*', head).eq('user_id', uid),
    supabase.from('community_likes').select('*', head).eq('user_id', uid),
    supabase.from('job_applications').select('*', head).eq('user_id', uid),
    // 받은 좋아요는 비정규화 카운터(like_count) 합으로 — 별도 조인 없이.
    supabase.from('community_posts').select('like_count').eq('user_id', uid),
    supabase.from('community_comments').select('like_count').eq('user_id', uid),
    supabase.from('user_activity_days').select('day').eq('user_id', uid).order('day', { ascending: false }).limit(400),
  ])

  const metrics = {
    posts: posts.count || 0,
    comments: comments.count || 0,
    likes_given: likesGiven.count || 0,
    likes_received: sum(myPosts.data, 'like_count') + sum(myComments.data, 'like_count'),
    applications: applications.count || 0,
    streak: computeStreak(days.data),
  }

  const earned = earnedEngagementKeys(metrics)
  if (earned.length) {
    const now = new Date().toISOString()
    const rows = earned.map(key => ({ user_id: uid, badge_type: key, is_active: true, granted_at: now }))
    // ignoreDuplicates: 이미 부여된 뱃지의 granted_at(획득일)은 유지.
    await supabase.from('user_badges').upsert(rows, { onConflict: 'user_id,badge_type', ignoreDuplicates: true })
  }

  return res.json({ metrics, earned })
}
