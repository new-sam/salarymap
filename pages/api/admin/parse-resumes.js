import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from './check'
import { parseResumeForUser } from '../../../lib/parseResume'

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)

export default async function handler(req, res) {
  const admin = await verifyAdmin(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // batch: 인재풀 "AI 전체 채우기"의 개별 호출 — updated_at을 안 건드려
  // 이력서풀 지표 착시(7/14 +294% 사례)와 어드민 정렬 뒤섞임을 막는다.
  const { userId, batch } = req.body
  if (!userId) return res.status(400).json({ error: 'userId required' })

  try {
    const update = await parseResumeForUser(userId, { touchUpdatedAt: !batch })
    return res.json({ userId, ...update, skills: (update.skills || []).join(', ') })
  } catch (err) {
    console.error('Admin resume parse error:', err)
    // 실패 마킹(resume_summary.parse_failed) — 스캔 PDF 등은 재실행해도 계속 실패라
    // 배치/카드 버튼에서 제외한다. 성공 파싱이 resume_summary를 덮어쓰면 자연 해제.
    try {
      const { data: p } = await supabase.from('user_profiles').select('resume_summary').eq('id', userId).single()
      await supabase.from('user_profiles')
        .update({ resume_summary: { ...(p?.resume_summary || {}), parse_failed: true } })
        .eq('id', userId)
    } catch {}
    return res.status(500).json({ error: err.message || 'Failed to parse resume', parse_failed: true })
  }
}
