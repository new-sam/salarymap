import { createClient } from '@supabase/supabase-js'
import { STATUS_PUSH, appPushTitle } from '../../../lib/application-push'
import { sendPush } from '../../../lib/push'
import { verifyAdminOrDevStub } from './check'
import { isExcludedEmail } from '../../../lib/admin-metrics'

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
      // 내부/테스트(@likelion.net 등) 지원은 모든 지표/목록에서 제외.
      .filter(a => !isExcludedEmail(a.user_email))

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
        sendPush([app.user_id], {
          title: appPushTitle(app.job_company, app.job_title),
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
