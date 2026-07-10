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
const JOB_AGE_HOURS = 48           // 등록 48시간 지난 공고만 자동발송 — 잘못 올린 공고가 수정/비활성화될 시간
const LANG = 'vi'

// 발송 요약 슬랙 알림 (실패해도 발송엔 영향 없음)
async function notifySlack(text) {
  const url = process.env.SLACK_CONTACT_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL
  if (!url) return
  try {
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
  } catch (_) {}
}

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const maxJobCreatedAt = new Date(Date.now() - JOB_AGE_HOURS * 3600000).toISOString()
  let applicants
  try {
    applicants = await computeMatches(DAYS, { maxJobCreatedAt })
  } catch (e) {
    await notifySlack(`:x: 유사공고 자동추천 cron 실패: ${e.message}`)
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
  const sentApplicants = []
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
    sentApplicants.push(a)
  }

  if (sent > 0 || skipped.length > 0) {
    // 발송된 공고별 건수 요약 — 이상한 공고가 나갔으면 여기서 바로 보이게
    const perJob = {}
    for (const a of sentApplicants) for (const j of a.jobs) perJob[`${j.title} (${j.company || '-'})`] = (perJob[`${j.title} (${j.company || '-'})`] || 0) + 1
    const jobLines = Object.entries(perJob).sort((a, b) => b[1] - a[1]).map(([t, n]) => `• ${t} → ${n}명`).join('\n')
    await notifySlack(
      `:incoming_envelope: *유사공고 자동추천 발송* — ${sent}명 발송${skipped.length ? `, 스킵 ${skipped.length}` : ''}${capped ? ` (100명 캡, 잔여 ${applicants.length - targets.length}명 내일)` : ''}\n${jobLines}`
    )
  }

  return res.status(200).json({ days: DAYS, matched: applicants.length, sent, jobs: jobRows, capped, skipped })
}
