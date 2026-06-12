import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// 사이드바 "진행중인 투표 대결". 마감 전(ends_at > now) 투표를 참여수(총 표) 많은 순으로.
// 각 투표에 글 제목/카테고리를 붙여 카드 한 줄로 렌더할 수 있게 돌려준다.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const limit = Math.min(parseInt(req.query.limit) || 5, 20)
  const nowIso = new Date().toISOString()

  const { data: polls, error } = await supabase
    .from('community_polls')
    .select('*')
    .gt('ends_at', nowIso)
  if (error) return res.status(500).json({ error: error.message })
  if (!polls?.length) return res.status(200).json({ polls: [] })

  // 참여 많은 순으로 정렬 후 상위 N개의 글 정보만 조회.
  const ranked = polls
    .sort((a, b) => (b.votes_a + b.votes_b) - (a.votes_a + a.votes_b))
    .slice(0, limit)

  const postIds = ranked.map(p => p.post_id)
  const { data: posts } = await supabase
    .from('community_posts')
    .select('id, title, category')
    .in('id', postIds)
  const postMap = {}
  ;(posts || []).forEach(p => { postMap[p.id] = p })

  const result = ranked
    .filter(p => postMap[p.post_id]) // 글이 삭제됐으면 제외
    .map(p => ({
      poll_id: p.id,
      post_id: p.post_id,
      title: postMap[p.post_id].title,
      category: postMap[p.post_id].category,
      option_a: p.option_a,
      option_b: p.option_b,
      votes_a: p.votes_a,
      votes_b: p.votes_b,
      ends_at: p.ends_at,
    }))

  return res.status(200).json({ polls: result })
}
