import { createClient } from '@supabase/supabase-js'
import { getSalaryTier } from '../../../lib/salaryTiers'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Accept only public URLs from our own Supabase storage, capped at `max` items.
// Guards against arbitrary/external URLs being stored and rendered as <img>.
function sanitizeImageUrls(value, max = 4) {
  if (!Array.isArray(value)) return []
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  return value
    .filter(u => typeof u === 'string' && base && u.startsWith(base))
    .slice(0, max)
}

// Map of user_id -> salary tier key for users with an active salary-range badge.
// Shown next to authors (incl. anonymous) as a trust signal.
async function salaryTierMap(userIds) {
  const ids = [...new Set(userIds)].filter(Boolean)
  if (!ids.length) return {}
  const { data } = await supabase
    .from('user_badges')
    .select('user_id, salary_amount')
    .in('user_id', ids)
    .eq('badge_type', 'salary_range')
    .eq('is_active', true)
  const map = {}
  ;(data || []).forEach(b => {
    const tier = getSalaryTier(b.salary_amount)
    if (tier) map[b.user_id] = tier.key
  })
  return map
}

// Map of user_id -> verified company name for users with an active verified_company
// badge. Shown next to authors as a ✓ trust signal (work-email verified).
async function companyVerifiedMap(userIds) {
  const ids = [...new Set(userIds)].filter(Boolean)
  if (!ids.length) return {}
  const { data: badges } = await supabase
    .from('user_badges')
    .select('user_id')
    .in('user_id', ids)
    .eq('badge_type', 'verified_company')
    .eq('is_active', true)
  const verifiedIds = (badges || []).map(b => b.user_id)
  if (!verifiedIds.length) return {}
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, verified_company_name')
    .in('id', verifiedIds)
  const map = {}
  ;(profiles || []).forEach(p => {
    if (p.verified_company_name) map[p.id] = p.verified_company_name
  })
  return map
}

// Map of user_id -> { user_type, verified_school }. user_type ('student'|'worker')
// drives the community author label's no-company fallback (학생 vs 직장인). The
// verified school name is the student-side mirror of verified_company_name and is
// only surfaced when the verified_school badge is active.
async function userTypeMap(userIds) {
  const ids = [...new Set(userIds)].filter(Boolean)
  if (!ids.length) return {}
  const { data: badges } = await supabase
    .from('user_badges')
    .select('user_id')
    .in('user_id', ids)
    .eq('badge_type', 'verified_school')
    .eq('is_active', true)
  const schoolIds = new Set((badges || []).map(b => b.user_id))
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, user_type, verified_school_name')
    .in('id', ids)
  const map = {}
  ;(profiles || []).forEach(p => {
    map[p.id] = {
      user_type: p.user_type || null,
      verified_school: schoolIds.has(p.id) ? (p.verified_school_name || null) : null,
    }
  })
  return map
}

// Map of user_id -> profile photo (user_profiles.photo_url), the picture the user
// uploaded in-app. Used to override author_avatar on non-anonymous posts so the
// in-app photo shows even when there's no social avatar. Anonymous posts skip this.
async function avatarMap(userIds) {
  const ids = [...new Set(userIds)].filter(Boolean)
  if (!ids.length) return {}
  const { data } = await supabase
    .from('user_profiles')
    .select('id, photo_url')
    .in('id', ids)
  const map = {}
  ;(data || []).forEach(p => {
    if (p.photo_url) map[p.id] = p.photo_url
  })
  return map
}

// User ids the caller has blocked — their content is excluded from GET responses.
// Returns [] for anon callers. (Reads the same token the GET handlers already use.)
async function blockedIdsFor(token) {
  if (!token) return []
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return []
  const { data } = await supabase
    .from('community_blocks')
    .select('blocked_id')
    .eq('blocker_id', user.id)
  return (data || []).map(b => b.blocked_id)
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { category, page = 1, limit = 20, sort = 'recent', search, id: postId, mine, interests } = req.query
    const blockedIds = await blockedIdsFor(req.headers.authorization?.replace('Bearer ', ''))

    // Single post fetch
    if (postId) {
      const { data: post, error } = await supabase
        .from('community_posts')
        .select('*')
        .eq('id', postId)
        .single()
      if (error || !post) return res.status(404).json({ error: 'Not found' })
      if (blockedIds.includes(post.user_id)) return res.status(404).json({ error: 'Not found' })

      // Increment view count only when explicitly requested
      if (req.query.view === '1') {
        await supabase
          .from('community_posts')
          .update({ view_count: (post.view_count || 0) + 1 })
          .eq('id', postId)
        post.view_count = (post.view_count || 0) + 1
      }

      const token = req.headers.authorization?.replace('Bearer ', '')
      if (token) {
        const { data: { user } } = await supabase.auth.getUser(token)
        if (user) {
          const { data: like } = await supabase
            .from('community_likes')
            .select('id')
            .eq('user_id', user.id)
            .eq('post_id', postId)
            .maybeSingle()
          post.is_liked = !!like
        }
      }
      const tierMap = await salaryTierMap([post.user_id])
      post.author_salary_tier = tierMap[post.user_id] || null
      const cvMap = await companyVerifiedMap([post.user_id])
      post.author_verified_company = cvMap[post.user_id] || null
      const utMap = await userTypeMap([post.user_id])
      post.author_user_type = utMap[post.user_id]?.user_type || null
      post.author_verified_school = utMap[post.user_id]?.verified_school || null
      const avMap = await avatarMap([post.user_id])
      post.author_avatar = post.is_anonymous ? null : (avMap[post.user_id] || post.author_avatar || null)
      return res.status(200).json({ post })
    }

    const offset = (parseInt(page) - 1) * parseInt(limit)

    // "Interests": posts the signed-in user has liked OR commented on. Requires auth.
    // We gather the post ids from both signals, union them, then page over the posts.
    if (interests) {
      const token = req.headers.authorization?.replace('Bearer ', '')
      if (!token) return res.status(401).json({ error: 'Unauthorized' })
      const { data: { user } } = await supabase.auth.getUser(token)
      if (!user) return res.status(401).json({ error: 'Unauthorized' })

      const [likes, comments] = await Promise.all([
        supabase.from('community_likes').select('post_id').eq('user_id', user.id).not('post_id', 'is', null),
        supabase.from('community_comments').select('post_id').eq('user_id', user.id),
      ])
      const ids = [...new Set([
        ...(likes.data || []).map(l => l.post_id),
        ...(comments.data || []).map(c => c.post_id),
      ].filter(Boolean))]

      if (ids.length === 0) {
        return res.status(200).json({ posts: [], total: 0, page: parseInt(page), totalPages: 0 })
      }

      let iq = supabase.from('community_posts').select('*', { count: 'exact' }).in('id', ids)
      if (blockedIds.length) iq = iq.not('user_id', 'in', `(${blockedIds.join(',')})`)
      if (category && category !== 'all') iq = iq.eq('category', category)
      if (search && search.trim()) {
        iq = iq.or(`title.ilike.%${search.trim()}%,content.ilike.%${search.trim()}%`)
      }
      iq = iq.order('created_at', { ascending: false }).range(offset, offset + parseInt(limit) - 1)

      const { data: iData, error: iErr, count: iCount } = await iq
      if (iErr) return res.status(500).json({ error: iErr.message })

      const iPostIds = iData.map(p => p.id)
      let iLiked = []
      if (iPostIds.length > 0) {
        const { data: ls } = await supabase
          .from('community_likes')
          .select('post_id')
          .eq('user_id', user.id)
          .in('post_id', iPostIds)
        iLiked = (ls || []).map(l => l.post_id)
      }
      const iTierMap = await salaryTierMap(iData.map(p => p.user_id))
      const iCvMap = await companyVerifiedMap(iData.map(p => p.user_id))
      const iUtMap = await userTypeMap(iData.map(p => p.user_id))
      const iAvMap = await avatarMap(iData.map(p => p.user_id))

      return res.status(200).json({
        posts: iData.map(p => ({ ...p, is_liked: iLiked.includes(p.id), author_salary_tier: iTierMap[p.user_id] || null, author_verified_company: iCvMap[p.user_id] || null, author_user_type: iUtMap[p.user_id]?.user_type || null, author_verified_school: iUtMap[p.user_id]?.verified_school || null, author_avatar: p.is_anonymous ? null : (iAvMap[p.user_id] || p.author_avatar || null) })),
        total: iCount,
        page: parseInt(page),
        totalPages: Math.ceil(iCount / parseInt(limit))
      })
    }

    let query = supabase
      .from('community_posts')
      .select('*', { count: 'exact' })

    if (blockedIds.length) query = query.not('user_id', 'in', `(${blockedIds.join(',')})`)

    if (mine) {
      const token = req.headers.authorization?.replace('Bearer ', '')
      if (token) {
        const { data: { user } } = await supabase.auth.getUser(token)
        if (user) query = query.eq('user_id', user.id)
      }
    }

    if (category && category !== 'all') {
      query = query.eq('category', category)
    }

    if (search && search.trim()) {
      query = query.or(`title.ilike.%${search.trim()}%,content.ilike.%${search.trim()}%`)
    }

    if (sort === 'popular') {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      query = query.gte('created_at', weekAgo).order('like_count', { ascending: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    query = query.range(offset, offset + parseInt(limit) - 1)

    const { data, error, count } = await query
    if (error) return res.status(500).json({ error: error.message })

    // If user is logged in, check which posts they've liked
    const token = req.headers.authorization?.replace('Bearer ', '')
    let likedPostIds = []
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token)
      if (user) {
        const postIds = data.map(p => p.id)
        if (postIds.length > 0) {
          const { data: likes } = await supabase
            .from('community_likes')
            .select('post_id')
            .eq('user_id', user.id)
            .in('post_id', postIds)
          likedPostIds = (likes || []).map(l => l.post_id)
        }
      }
    }

    const tierMap = await salaryTierMap(data.map(p => p.user_id))
    const cvMap = await companyVerifiedMap(data.map(p => p.user_id))
    const utMap = await userTypeMap(data.map(p => p.user_id))
    const avMap = await avatarMap(data.map(p => p.user_id))

    return res.status(200).json({
      posts: data.map(p => ({ ...p, is_liked: likedPostIds.includes(p.id), author_salary_tier: tierMap[p.user_id] || null, author_verified_company: cvMap[p.user_id] || null, author_user_type: utMap[p.user_id]?.user_type || null, author_verified_school: utMap[p.user_id]?.verified_school || null, author_avatar: p.is_anonymous ? null : (avMap[p.user_id] || p.author_avatar || null) })),
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit))
    })
  }

  if (req.method === 'POST') {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const { category, title, content, is_anonymous } = req.body
    if (!category || !title || !content) {
      return res.status(400).json({ error: 'Missing required fields' })
    }
    const image_urls = sanitizeImageUrls(req.body.image_urls)

    const validCategories = ['ask_company', 'daily', 'job_change']
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' })
    }

    const realName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
    const authorName = is_anonymous
      ? (realName.charAt(0) + '**')
      : realName

    // Author company / salary badges are derived at read time from the
    // email-verified company badge (see companyVerifiedMap / salaryTierMap),
    // not from any self-entered field at write time.
    const { data, error } = await supabase
      .from('community_posts')
      .insert({
        user_id: user.id,
        author_name: authorName,
        author_avatar: is_anonymous ? null : user.user_metadata?.avatar_url,
        category,
        title,
        content,
        image_urls,
        is_anonymous: is_anonymous !== false
      })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  if (req.method === 'PUT') {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const { id } = req.query
    const { category, title, content } = req.body
    if (!category || !title || !content) {
      return res.status(400).json({ error: 'Missing required fields' })
    }
    const image_urls = sanitizeImageUrls(req.body.image_urls)

    const { data, error } = await supabase
      .from('community_posts')
      .update({ category, title, content, image_urls })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const { id } = req.query
    const { error } = await supabase
      .from('community_posts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
