// 유사공고 자동추천 메일 cron — 최근 지원자에게 "지원한 공고와 비슷한 공고" 메일을 매일 자동 발송.
// 매칭/메일 조립은 어드민 API(admin/similar-recommend.js)의 computeMatches/composeEmail 재사용.
// 중복발송은 job_recommendations (user_id|email + job_id) 로 막히므로, 매일 돌아도
// 새 지원자 또는 새 공고가 생겼을 때만 메일이 나간다. 수신자는 베트남 구직자 → vi 고정.
// Vercel cron이 Authorization: Bearer ${CRON_SECRET} 헤더로 호출(daily-hot-post.js와 동일).
// vercel.json crons: { "path": "/api/cron/similar-recommend", "schedule": "0 3 * * *" }  (03:00 UTC = 10:00 ICT)
// 수동 점검: GET ?dry=1 — 발송 없이 매칭 결과만 반환.
import { createClient } from '@supabase/supabase-js'
import { computeMatches, composeEmail } from '../admin/similar-recommend'
import { sendPush } from '../../../lib/push'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DAYS = 30                    // "최근 지원자" 범위 — 이보다 오래된 지원 이력엔 발송 안 함
const MAX_RECIPIENTS_PER_RUN = 100 // 한 번에 너무 많이 나가지 않게(첫 실행 백로그 대비). 남은 사람은 다음 날.
const LANG = 'vi'

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  let applicants
  try {
    applicants = await computeMatches(DAYS)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }

  const capped = applicants.length > MAX_RECIPIENTS_PER_RUN
  const targets = applicants.slice(0, MAX_RECIPIENTS_PER_RUN)

  if (req.query.dry) {
    return res.status(200).json({
      dry: true, days: DAYS, matched: applicants.length, wouldSend: targets.length, capped,
      applicants: targets.map(a => ({ email: a.email, name: a.name, jobs: a.jobs.map(j => j.title) })),
    })
  }

  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)

  let sent = 0, jobRows = 0
  const skipped = []
  for (const a of targets) {
    const email = composeEmail({
      name: a.name,
      appliedTitle: a.applied?.title || '',
      appliedCompany: a.applied?.company || '',
      jobs: a.jobs,
      lang: LANG,
    })
    try {
      const r = await resend.emails.send({ from: process.env.RESEND_FROM || 'FYI <onboarding@resend.dev>', to: a.email, subject: email.subject, text: email.text, html: email.html })
      if (r.error) throw new Error(r.error.message || 'resend_error')
    } catch (e) {
      skipped.push({ email: a.email, reason: `send_fail: ${e.message}` })
      continue
    }

    if (a.user_id) {
      sendPush([a.user_id], {
        title: { vi: `${a.jobs.length} việc làm phù hợp với bạn`, ko: `회원님께 맞는 공고 ${a.jobs.length}건`, en: `${a.jobs.length} jobs matched for you` },
        body: a.jobs[0].title,
        category: 'job_recommendation',
        data: { url: `/jobs/${a.jobs[0].id}` },
      })
    }

    const rows = a.jobs.map(j => ({
      user_id: a.user_id || null,
      to_email: a.email,
      job_id: j.id,
      job_title: j.title,
      job_company: j.company,
      sent_by: 'cron',
      status: 'sent',
      kind: 'similar',
    }))
    const { error: insErr } = await supabase.from('job_recommendations').insert(rows)
    if (insErr) { skipped.push({ email: a.email, reason: `logged_fail: ${insErr.message}` }); continue }
    sent += 1
    jobRows += a.jobs.length
  }

  return res.status(200).json({ days: DAYS, matched: applicants.length, sent, jobs: jobRows, capped, skipped })
}
