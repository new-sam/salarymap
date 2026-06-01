import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { post_id } = req.query
    if (!post_id) return res.status(400).json({ error: 'post_id required' })

    const { data, error } = await supabase
      .from('community_comments')
      .select('*')
      .eq('post_id', post_id)
      .order('created_at', { ascending: true })

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

    return res.status(200).json({
      comments: data.map(c => ({ ...c, is_liked: likedCommentIds.includes(c.id) }))
    })
  }

  if (req.method === 'POST') {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const { post_id, content, is_anonymous } = req.body
    if (!post_id || !content) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const realName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
    const authorName = is_anonymous
      ? (realName.charAt(0) + '**')
      : realName

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

    // Fetch the post to flag original-poster (OP) comments and to bump the count
    const { data: postData } = await supabase
      .from('community_posts')
      .select('user_id, comment_count')
      .eq('id', post_id)
      .single()
    const isOp = !!(postData && postData.user_id === user.id)

    const { data, error } = await supabase
      .from('community_comments')
      .insert({
        post_id,
        user_id: user.id,
        author_name: authorName,
        content,
        is_anonymous: is_anonymous !== false,
        is_salary_verified: isSalaryVerified,
        author_company: authorCompany,
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

    return res.status(201).json(data)
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
