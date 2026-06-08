import { createClient } from '@supabase/supabase-js'
import { getSalaryTier } from '../../../lib/salaryTiers'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Accept only a public URL from our own Supabase storage, else null.
function sanitizeImageUrl(value) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  return typeof value === 'string' && base && value.startsWith(base) ? value : null
}

// Map of user_id -> salary tier key for users with an active salary-range badge.
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

// Map of user_id -> verified company name (active verified_company badge).
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

// Map of user_id -> profile photo (user_profiles.photo_url), the picture the user
// uploaded in-app. Used to set author_avatar on non-anonymous comments so the
// in-app photo shows. Anonymous comments skip this.
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

// User ids the caller has blocked — their comments are excluded from GET responses.
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
    const { post_id } = req.query
    if (!post_id) return res.status(400).json({ error: 'post_id required' })

    const blockedIds = await blockedIdsFor(req.headers.authorization?.replace('Bearer ', ''))
    let cq = supabase
      .from('community_comments')
      .select('*')
      .eq('post_id', post_id)
      .order('created_at', { ascending: true })
    if (blockedIds.length) cq = cq.not('user_id', 'in', `(${blockedIds.join(',')})`)
    const { data, error } = await cq

    if (error) return res.status(500).json({ error: error.message })

    // Check likes for logged in user
    const token = req.headers.authorization?.replace('Bearer ', '')
    let likedCommentIds = []
    if (token && data.length > 0) {
      const { data: { user } } = await supabase.auth.getUser(token)
      if (user) {
        const commentIds = data.map(c => c.id)
        const { data: likes } = await supabase
          .from('community_likes')
          .select('comment_id')
          .eq('user_id', user.id)
          .in('comment_id', commentIds)
        likedCommentIds = (likes || []).map(l => l.comment_id)
      }
    }

    const tierMap = await salaryTierMap(data.map(c => c.user_id))
    const cvMap = await companyVerifiedMap(data.map(c => c.user_id))
    const avMap = await avatarMap(data.map(c => c.user_id))

    return res.status(200).json({
      comments: data.map(c => ({ ...c, is_liked: likedCommentIds.includes(c.id), author_salary_tier: tierMap[c.user_id] || null, author_verified_company: cvMap[c.user_id] || null, author_avatar: c.is_anonymous ? null : (avMap[c.user_id] || null) }))
    })
  }

  if (req.method === 'POST') {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const { post_id, content, is_anonymous } = req.body
    const image_url = sanitizeImageUrl(req.body.image_url)
    if (!post_id || (!content && !image_url)) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const realName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'

    // Fetch the post to flag original-poster (OP) comments, inherit its privacy, and bump the count.
    const { data: postData } = await supabase
      .from('community_posts')
      .select('user_id, comment_count, is_anonymous')
      .eq('id', post_id)
      .single()
    const isOp = !!(postData && postData.user_id === user.id)

    // OP가 자기 글에 다는 댓글은 글의 공개/익명을 그대로 상속(익명글→익명, 공개글→공개).
    // 그 외 댓글은 작성자가 고른 is_anonymous를 따른다(기본 익명).
    const effectiveAnon = isOp ? (postData?.is_anonymous !== false) : (is_anonymous !== false)
    const authorName = effectiveAnon ? (realName.charAt(0) + '**') : realName

    const { data, error } = await supabase
      .from('community_comments')
      .insert({
        post_id,
        user_id: user.id,
        author_name: authorName,
        content,
        image_url,
        is_anonymous: effectiveAnon,
        is_op: isOp
      })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })

    // Increment comment count on the post
    if (postData) {
      await supabase
        .from('community_posts')
        .update({ comment_count: (postData.comment_count || 0) + 1 })
        .eq('id', post_id)
    }

    // Enrich the response with the same author trust signals the GET returns,
    // so the freshly-posted comment shows company / salary badge without a reload.
    const tierMap = await salaryTierMap([user.id])
    const cvMap = await companyVerifiedMap([user.id])
    const avMap = await avatarMap([user.id])

    return res.status(201).json({
      ...data,
      is_liked: false,
      author_salary_tier: tierMap[user.id] || null,
      author_verified_company: cvMap[user.id] || null,
      author_avatar: data.is_anonymous ? null : (avMap[user.id] || null),
    })
  }

  if (req.method === 'DELETE') {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const { id, post_id } = req.query
    if (!id) return res.status(400).json({ error: 'id required' })

    const { error } = await supabase
      .from('community_comments')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return res.status(500).json({ error: error.message })

    // Decrement comment count
    if (post_id) {
      const { data: p } = await supabase
        .from('community_posts')
        .select('comment_count')
        .eq('id', post_id)
        .single()
      if (p) {
        await supabase
          .from('community_posts')
          .update({ comment_count: Math.max(0, (p.comment_count || 0) - 1) })
          .eq('id', post_id)
      }
    }

    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
