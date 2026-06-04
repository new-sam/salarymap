import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Real activity over the last 7 days (posts + comments), surfaced as a badge
// on the community tab to signal the community is alive. Not a presence count —
// it's an honest count of recent contributions.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [posts, comments] = await Promise.all([
    supabase.from('community_posts').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
    supabase.from('community_comments').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
  ])

  const count = (posts.count || 0) + (comments.count || 0)

  // Cache at the edge for 5 min — this number moves slowly and is non-critical.
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
  return res.status(200).json({ count })
}
