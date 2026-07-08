import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from './check'
import { sendJobApprovedMail } from '../../../lib/companyEmails'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// 공고 승인 시 등록한 기업(작성자)에게 게재 완료 알림 (Email + Slack, 베스트에포트)
export default async function handler(req, res) {
  const admin = await verifyAdmin(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { jobId } = req.body || {}
  if (!jobId) return res.status(400).json({ error: 'jobId 필요' })

  const { data: job } = await supabase
    .from('jobs')
    .select('id, title, company, created_by')
    .eq('id', jobId).maybeSingle()
  if (!job) return res.status(404).json({ error: 'job not found' })

  // 작성자 이메일
  let posterEmail = null
  if (job.created_by) {
    const { data: ru } = await supabase
      .from('recruiter_users').select('email').eq('user_id', job.created_by).maybeSingle()
    posterEmail = ru?.email || null
  }

  // Email (작성자에게)
  if (posterEmail) {
    try {
      await sendJobApprovedMail({ toEmail: posterEmail, jobTitle: job.title, companyName: job.company })
    } catch (_) {}
  }

  // Slack (운영 기록용, 옵션)
  const slackUrl = process.env.SLACK_CONTACT_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL
  if (slackUrl) {
    try {
      await fetch(slackUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `:white_check_mark: *공고 승인됨* — ${job.title} (${job.company}) → ${posterEmail || '작성자 미상'}` }),
      })
    } catch (_) {}
  }

  return res.status(200).json({ ok: true, notified: posterEmail })
}
