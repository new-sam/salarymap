import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from './check'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// service_role로 신고/차단/피드백 테이블을 읽는다(이들 테이블엔 SELECT 정책이 없어 운영자만 조회 가능).
export default async function handler(req, res) {
  const admin = await verifyAdmin(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const [reportsR, blocksR, feedbackR] = await Promise.all([
      supabase.from('community_reports').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('community_blocks').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('app_feedback').select('*').order('created_at', { ascending: false }).limit(500),
    ])
    const reports = reportsR.data || []
    const blocks = blocksR.data || []
    const feedback = feedbackR.data || []

    // 유저 id → 이메일/이름 매핑(user_profiles).
    const userIds = [...new Set([
      ...reports.map(r => r.reporter_id),
      ...blocks.flatMap(b => [b.blocker_id, b.blocked_id]),
      ...feedback.map(f => f.user_id),
    ].filter(Boolean))]
    const profileMap = {}
    if (userIds.length) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, email, full_name')
        .in('id', userIds)
      ;(profiles || []).forEach(p => { profileMap[p.id] = p })
    }
    const who = (id) => profileMap[id]?.email || profileMap[id]?.full_name || '—'

    // 신고 대상(글/댓글) 본문 미리보기.
    const postIds = reports.filter(r => r.target_type === 'post').map(r => r.target_id)
    const commentIds = reports.filter(r => r.target_type === 'comment').map(r => r.target_id)
    const postMap = {}
    const commentMap = {}
    if (postIds.length) {
      const { data } = await supabase.from('community_posts').select('id, title, content').in('id', postIds)
      ;(data || []).forEach(p => { postMap[p.id] = p })
    }
    if (commentIds.length) {
      const { data } = await supabase.from('community_comments').select('id, content').in('id', commentIds)
      ;(data || []).forEach(c => { commentMap[c.id] = c })
    }
    const targetPreview = (r) => {
      if (r.target_type === 'post') {
        const p = postMap[r.target_id]
        if (!p) return '(삭제됨)'
        return [p.title, p.content].filter(Boolean).join(' — ').slice(0, 140)
      }
      const c = commentMap[r.target_id]
      if (!c) return '(삭제됨)'
      return (c.content || '').slice(0, 140)
    }

    return res.status(200).json({
      reports: reports.map(r => ({
        ...r,
        reporter_email: who(r.reporter_id),
        target_preview: targetPreview(r),
      })),
      blocks: blocks.map(b => ({
        ...b,
        blocker_email: who(b.blocker_id),
        blocked_email: who(b.blocked_id),
      })),
      feedback: feedback.map(f => ({
        ...f,
        user_email: who(f.user_id),
      })),
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
