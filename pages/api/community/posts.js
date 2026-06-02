import { createClient } from '@supabase/supabase-js'
import { getSalaryTier } from '../../../lib/salaryTiers'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

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

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { category, page = 1, limit = 20, sort = 'recent', search, id: postId, mine } = req.query

    // Single post fetch
    if (postId) {
      const { data: post, error } = await supabase
        .from('community_posts')
        .select('*')
        .eq('id', postId)
        .single()
      if (error || !post) return res.status(404).json({ error: 'Not found' })

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
      return res.status(200).json({ post })
    }

    const offset = (parseInt(page) - 1) * parseInt(limit)

    let query = supabase
      .from('community_posts')
      .select('*', { count: 'exact' })

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

    return res.status(200).json({
      posts: data.map(p => ({ ...p, is_liked: likedPostIds.includes(p.id), author_salary_tier: tierMap[p.user_id] || null })),
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

    const validCategories = ['ask_company', 'daily', 'job_change']
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' })
    }

    const realName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
    const authorName = is_anonymous
      ? (realName.charAt(0) + '**')
      : realName

    // Get company from user profile
    let isSalaryVerified = false
    let authorCompany = null
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('current_company')
      .eq('id', user.id)
      .maybeSingle()
    if (userProfile?.current_company) {
      isSalaryVerified = true
      authorCompany = userProfile.current_company
    }

    const { data, error } = await supabase
      .from('community_posts')
      .insert({
        user_id: user.id,
        author_name: authorName,
        author_avatar: is_anonymous ? null : user.user_metadata?.avatar_url,
        category,
        title,
        content,
        is_anonymous: is_anonymous !== false,
        is_salary_verified: isSalaryVerified,
        author_company: authorCompany
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

    const { data, error } = await supabase
      .from('community_posts')
      .update({ category, title, content })
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
