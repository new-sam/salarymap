import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from './check'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// service_role로 신고/피드백을 읽고(이들 테이블엔 SELECT 정책이 없어 운영자만 조회 가능),
// 신고 처리(대상 글·댓글 삭제 / 신고 무시)를 수행한다.
export default async function handler(req, res) {
  const admin = await verifyAdmin(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') return getQueue(res)
  if (req.method === 'POST') return handleAction(req, res)
  return res.status(405).json({ error: 'Method not allowed' })
}

async function getQueue(res) {
  try {
    const [reportsR, feedbackR] = await Promise.all([
      supabase.from('community_reports').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('app_feedback').select('*').order('created_at', { ascending: false }).limit(500),
    ])
    const reports = reportsR.data || []
    const feedback = feedbackR.data || []

    // 유저 id → 이메일/이름 매핑(user_profiles).
    const userIds = [...new Set([
      ...reports.map(r => r.reporter_id),
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
    const preview = (r) => {
      if (r.target_type === 'post') {
        const p = postMap[r.target_id]
        return p ? [p.title, p.content].filter(Boolean).join(' — ').slice(0, 140) : null
      }
      const c = commentMap[r.target_id]
      return c ? (c.content || '').slice(0, 140) : null
    }

    return res.status(200).json({
      reports: reports.map(r => ({
        ...r,
        reporter_email: who(r.reporter_id),
        target_preview: preview(r),
        target_deleted: preview(r) === null, // 이미 삭제된 대상
      })),
      feedback: feedback.map(f => ({ ...f, user_email: who(f.user_id) })),
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

// action: 'delete-content'   → 신고된 글/댓글 삭제 + 관련 신고 제거
//         'dismiss'          → 신고만 제거(콘텐츠 유지)
//         'feedback-handled' → 피드백 처리완료 토글
async function handleAction(req, res) {
  const { action, target_type, target_id, id, handled } = req.body || {}

  // 피드백 처리완료 토글.
  if (action === 'feedback-handled') {
    if (!id) return res.status(400).json({ error: 'id required' })
    const { error } = await supabase
      .from('app_feedback').update({ handled: !!handled }).eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  if (!['post', 'comment'].includes(target_type) || !target_id) {
    return res.status(400).json({ error: 'invalid target' })
  }

  try {
    if (action === 'delete-content') {
      if (target_type === 'post') {
        // FK ON DELETE CASCADE가 댓글·좋아요까지 정리한다.
        const { error } = await supabase.from('community_posts').delete().eq('id', target_id)
        if (error) return res.status(500).json({ error: error.message })
      } else {
        // 댓글: 부모 글 comment_count를 수동 차감해야 한다(트리거 없음).
        const { data: c } = await supabase
          .from('community_comments').select('post_id').eq('id', target_id).single()
        const { error } = await supabase.from('community_comments').delete().eq('id', target_id)
        if (error) return res.status(500).json({ error: error.message })
        if (c?.post_id) {
          const { data: p } = await supabase
            .from('community_posts').select('comment_count').eq('id', c.post_id).single()
          if (p) {
            await supabase.from('community_posts')
              .update({ comment_count: Math.max(0, (p.comment_count || 0) - 1) })
              .eq('id', c.post_id)
          }
        }
      }
    } else if (action !== 'dismiss') {
      return res.status(400).json({ error: 'invalid action' })
    }

    // 처리 완료 → 해당 대상의 신고를 큐에서 제거.
    await supabase.from('community_reports')
      .delete().eq('target_type', target_type).eq('target_id', target_id)

    return res.status(200).json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
