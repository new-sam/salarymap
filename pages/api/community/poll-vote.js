import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// A/B 투표 1표. 1인 1표·변경불가(unique 제약). 마감 후엔 거부.
// 투표 성공 시 비정규화 카운터(votes_a/votes_b)를 증가시키고 최신 현황을 돌려준다.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { poll_id, choice } = req.body
  if (!poll_id || (choice !== 'a' && choice !== 'b')) {
    return res.status(400).json({ error: 'Invalid vote' })
  }

  const { data: poll, error: pollErr } = await supabase
    .from('community_polls')
    .select('*')
    .eq('id', poll_id)
    .single()
  if (pollErr || !poll) return res.status(404).json({ error: 'Poll not found' })
  if (new Date(poll.ends_at).getTime() <= Date.now()) {
    return res.status(409).json({ error: 'closed', message: '마감된 투표예요.' })
  }

  // unique(poll_id, user_id) 위반 = 이미 투표함 → 23505
  const { error: voteErr } = await supabase
    .from('community_poll_votes')
    .insert({ poll_id, user_id: user.id, choice })
  if (voteErr) {
    if (voteErr.code === '23505') {
      return res.status(409).json({ error: 'already_voted', votes_a: poll.votes_a, votes_b: poll.votes_b })
    }
    return res.status(500).json({ error: voteErr.message })
  }

  const col = choice === 'a' ? 'votes_a' : 'votes_b'
  const next = (poll[col] || 0) + 1
  await supabase.from('community_polls').update({ [col]: next }).eq('id', poll_id)

  return res.status(200).json({
    ok: true,
    choice,
    votes_a: choice === 'a' ? next : poll.votes_a,
    votes_b: choice === 'b' ? next : poll.votes_b,
  })
}
