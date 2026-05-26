import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { post_id, comment_id } = req.body
  if (!post_id && !comment_id) {
    return res.status(400).json({ error: 'post_id or comment_id required' })
  }

  const matchField = post_id ? 'post_id' : 'comment_id'
  const matchValue = post_id || comment_id
  const targetTable = post_id ? 'community_posts' : 'community_comments'

  // Check if already liked
  const { data: existing } = await supabase
    .from('community_likes')
    .select('id')
    .eq('user_id', user.id)
    .eq(matchField, matchValue)
    .maybeSingle()

  if (existing) {
    // Unlike
    await supabase.from('community_likes').delete().eq('id', existing.id)

    // Decrement like count
    const { data: target } = await supabase
      .from(targetTable)
      .select('like_count')
      .eq('id', matchValue)
      .single()

    if (target) {
      await supabase
        .from(targetTable)
        .update({ like_count: Math.max(0, (target.like_count || 0) - 1) })
        .eq('id', matchValue)
    }

    return res.status(200).json({ liked: false })
  } else {
    // Like
    const insertData = { user_id: user.id }
    if (post_id) insertData.post_id = post_id
    if (comment_id) insertData.comment_id = comment_id

    const { error } = await supabase.from('community_likes').insert(insertData)
    if (error) return res.status(500).json({ error: error.message })

    // Increment like count
    const { data: target } = await supabase
      .from(targetTable)
      .select('like_count')
      .eq('id', matchValue)
      .single()

    if (target) {
      await supabase
        .from(targetTable)
        .update({ like_count: (target.like_count || 0) + 1 })
        .eq('id', matchValue)
    }

    return res.status(200).json({ liked: true })
  }
}
