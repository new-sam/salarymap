import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from './check'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const RESEND_FROM = process.env.RESEND_FROM || 'FYI <onboarding@resend.dev>'

async function sendDecisionMail({ decision, job, toEmail, adminEmail }) {
  if (!process.env.RESEND_API_KEY || !toEmail) return
  try {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    const isApprove = decision === 'live'
    const subject = isApprove
      ? `[FYI] 공고가 승인되어 게재되었습니다 — ${job.title}`
      : `[FYI] 공고 검토 결과 안내 — ${job.title}`
    const liveUrl = `https://salary-fyi.com/jobs`
    const dashUrl = `https://salary-fyi.com/company`
    const inner = isApprove ? `
<div style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:32px 28px">
  <div style="font-size:13px;font-weight:800;color:#059669;letter-spacing:.04em">✓ 공고 승인 완료</div>
  <h2 style="margin:8px 0 14px;font-size:22px;line-height:1.3">${job.title} 공고가<br/>지금부터 후보자에게 공개됩니다.</h2>
  <p style="line-height:1.65;color:#374151;font-size:14px">FYI에서 검토를 마쳤습니다. 이제 베트남 IT 후보자들이 이 공고를 볼 수 있고, 지원이 들어오면 채용팀 화면에서 바로 관리할 수 있습니다.</p>
  <p style="margin:22px 0"><a href="${dashUrl}" style="background:#ea580c;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:800;display:inline-block">채용 대시보드 열기 →</a></p>
  <p style="font-size:12px;color:#9ca3af;border-top:1px solid #eee;padding-top:14px">공개 채용 페이지: <a href="${liveUrl}" style="color:#6b7280">${liveUrl}</a></p>
</div>` : `
<div style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:32px 28px">
  <div style="font-size:13px;font-weight:800;color:#dc2626;letter-spacing:.04em">공고 검토 결과</div>
  <h2 style="margin:8px 0 14px;font-size:21px;line-height:1.35">${job.title} 공고는<br/>이번에 게재가 어렵습니다.</h2>
  <p style="line-height:1.65;color:#374151;font-size:14px">검토 결과 현재 기준상 게재가 어려운 부분이 있어 공개되지 않았습니다. 내용을 보완하거나, 어떤 점이 문제였는지 함께 검토하고 싶으시면 회신 주세요 — 빠르게 다시 점검해드리겠습니다.</p>
  <p style="margin:22px 0"><a href="${dashUrl}" style="background:#111;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:800;display:inline-block">대시보드에서 수정하기 →</a></p>
  <p style="font-size:12px;color:#9ca3af">검토 담당: ${adminEmail || 'FYI'}</p>
</div>`
    const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8" /><title>FYI</title></head><body style="margin:0;padding:0;background:#f4f4f5">
<div style="max-width:560px;margin:0 auto;padding:32px 20px;font-family:'Pretendard',-apple-system,'Apple SD Gothic Neo','Segoe UI',Arial,sans-serif;color:#111">
  <div style="margin-bottom:28px"><span style="font-weight:950;letter-spacing:-.04em;font-size:22px;color:#ea580c">FYI</span> <span style="font-size:12px;color:#9ca3af;margin-left:6px">베트남 IT 채용</span></div>
  ${inner}
</div>
</body></html>`
    const text = isApprove
      ? `[FYI] ${job.title} 공고가 승인되었습니다.\n지금부터 후보자에게 공개됩니다.\n대시보드: ${dashUrl}`
      : `[FYI] ${job.title} 공고는 이번에 게재가 어렵습니다.\n자세한 사유나 보완 방법이 필요하면 이 메일에 회신 주세요.\n대시보드: ${dashUrl}`
    await resend.emails.send({
      from: RESEND_FROM, to: toEmail, replyTo: adminEmail || undefined,
      subject, text, html,
    })
  } catch (_) {}
}

export default async function handler(req, res) {
  const admin = await verifyAdmin(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const { data } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false })
    return res.status(200).json(data || [])
  }

  if (req.method === 'POST') {
    const { data, error } = await supabase
      .from('jobs')
      .insert(req.body)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  if (req.method === 'PUT') {
    const { id, ...updates } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })

    // 현재 상태 + 작성자 이메일 사전 조회 (전환 시점 메일 통보용)
    const { data: prev } = await supabase
      .from('jobs')
      .select('status, created_by, title')
      .eq('id', id).maybeSingle()

    const { data, error } = await supabase
      .from('jobs')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })

    // pending_review -> live | rejected 전환이면 기업 작성자에게 통보 (베스트에포트)
    if (prev?.status === 'pending_review' && (data.status === 'live' || data.status === 'rejected')) {
      let toEmail = null
      if (prev.created_by) {
        const { data: u } = await supabase
          .from('recruiter_users')
          .select('email')
          .eq('user_id', prev.created_by)
          .maybeSingle()
        toEmail = u?.email || null
      }
      if (toEmail) {
        await sendDecisionMail({
          decision: data.status,
          job: { title: data.title || prev.title, id: data.id },
          toEmail,
          adminEmail: admin.email,
        })
      }
    }

    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })
    const { error } = await supabase.from('jobs').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
