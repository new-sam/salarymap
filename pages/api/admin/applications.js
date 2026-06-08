import { createClient } from '@supabase/supabase-js'
import { sendPush } from '../../../lib/push'
import { verifyAdmin } from './check'

// 지원 상태 → 지원자에게 보낼 단계 안내 문구(vi, 1차 시장 기준).
const STATUS_PUSH_VI = {
  applied: 'Hồ sơ của bạn đã được tiếp nhận',
  pending: 'Hồ sơ của bạn đã được tiếp nhận',
  viewed: 'Nhà tuyển dụng đã xem hồ sơ của bạn',
  reviewing: 'Hồ sơ của bạn đang được xem xét',
  decided: 'Đã có kết quả cho hồ sơ ứng tuyển của bạn',
  accepted: 'Chúc mừng! Hồ sơ của bạn đã được chấp nhận',
  rejected: 'Đã có cập nhật cho hồ sơ ứng tuyển của bạn',
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  const admin = await verifyAdmin(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const { from, to } = req.query
    let query = supabase
      .from('job_applications')
      .select('*, jobs(title, company)')
    if (from) query = query.gte('created_at', `${from}T00:00:00`)
    if (to) query = query.lte('created_at', `${to}T23:59:59`)
    const { data } = await query.order('created_at', { ascending: false })

    const userIds = [...new Set((data || []).map(a => a.user_id).filter(Boolean))]
    let profileMap = {}
    if (userIds.length) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, email, full_name')
        .in('id', userIds)
      ;(profiles || []).forEach(p => { profileMap[p.id] = p })
    }

    const enriched = (data || []).map(a => ({
      ...a,
      user_email: a.applicant_email || profileMap[a.user_id]?.email || '—',
      user_name: a.applicant_name || profileMap[a.user_id]?.full_name || '—',
    }))

    return res.status(200).json(enriched)
  }

  if (req.method === 'PUT') {
    const { id, status, admin_note } = req.body
    const updates = { status, updated_at: new Date().toISOString() }
    if (admin_note !== undefined) updates.admin_note = admin_note
    const { error } = await supabase
      .from('job_applications')
      .update(updates)
      .eq('id', id)
    if (error) return res.status(500).json({ error: error.message })

    // 지원 단계 변경 알림 — 지원자 본인에게 푸시(카테고리 'application').
    if (status && STATUS_PUSH_VI[status]) {
      const { data: app } = await supabase
        .from('job_applications')
        .select('user_id, job_title, job_company')
        .eq('id', id)
        .maybeSingle()
      if (app?.user_id) {
        const where = [app.job_company, app.job_title].filter(Boolean).join(' · ')
        sendPush([app.user_id], {
          title: where || 'Cập nhật ứng tuyển',
          body: STATUS_PUSH_VI[status],
          category: 'application',
          data: { url: '/jobs/applications' },
        })
      }
    }

    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
