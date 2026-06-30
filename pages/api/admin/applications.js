import { createClient } from '@supabase/supabase-js'
import { sendPush } from '../../../lib/push'
import { verifyAdminOrDevStub } from './check'

// 지원 상태 → 지원자에게 보낼 단계 안내 문구. 토큰 locale(vi|ko|en)별로 push.js가 선택.
const STATUS_PUSH = {
  applied: {
    vi: 'Hồ sơ của bạn đã được tiếp nhận',
    ko: '지원서가 접수되었습니다',
    en: 'Your application has been received',
  },
  pending: {
    vi: 'Hồ sơ của bạn đã được tiếp nhận',
    ko: '지원서가 접수되었습니다',
    en: 'Your application has been received',
  },
  viewed: {
    vi: 'Nhà tuyển dụng đã xem hồ sơ của bạn',
    ko: '채용 담당자가 지원서를 열람했습니다',
    en: 'The recruiter viewed your application',
  },
  reviewing: {
    vi: 'Hồ sơ của bạn đang được xem xét',
    ko: '지원서를 검토하고 있습니다',
    en: 'Your application is under review',
  },
  decided: {
    vi: 'Đã có kết quả cho hồ sơ ứng tuyển của bạn',
    ko: '지원 결과가 나왔습니다',
    en: 'A decision has been made on your application',
  },
  accepted: {
    vi: 'Chúc mừng! Hồ sơ của bạn đã được chấp nhận',
    ko: '축하합니다! 지원서가 합격되었습니다',
    en: 'Congratulations! Your application was accepted',
  },
  rejected: {
    vi: 'Đã có cập nhật cho hồ sơ ứng tuyển của bạn',
    ko: '지원서에 업데이트가 있습니다',
    en: 'There is an update on your application',
  },
}

// 회사·직무가 없을 때의 제목 폴백.
const APP_FALLBACK_TITLE = {
  vi: 'Cập nhật ứng tuyển',
  ko: '지원 현황 업데이트',
  en: 'Application update',
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const { from, to } = req.query
    // PostgREST는 한 번에 최대 1000행만 반환하므로 range로 끝까지 페이지네이션.
    const PAGE = 1000
    let data = []
    for (let offset = 0; ; offset += PAGE) {
      let query = supabase
        .from('job_applications')
        .select('*, jobs(title, company)')
      if (from) query = query.gte('created_at', `${from}T00:00:00`)
      if (to) query = query.lte('created_at', `${to}T23:59:59`)
      const { data: page } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE - 1)
      if (!page?.length) break
      data = data.concat(page)
      if (page.length < PAGE) break
    }

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
    if (status && STATUS_PUSH[status]) {
      const { data: app } = await supabase
        .from('job_applications')
        .select('user_id, job_title, job_company')
        .eq('id', id)
        .maybeSingle()
      if (app?.user_id) {
        // 회사·직무는 사용자 데이터라 언어 중립. 없으면 언어별 폴백 제목.
        const where = [app.job_company, app.job_title].filter(Boolean).join(' · ')
        sendPush([app.user_id], {
          title: where || APP_FALLBACK_TITLE,
          body: STATUS_PUSH[status],
          category: 'application',
          data: { url: '/jobs/applications' },
        })
      }
    }

    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
