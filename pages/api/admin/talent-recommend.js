import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'

// 인재풀 → 공고 추천 메일.
// GET  : 발송 이력 + 실제 지원 여부(job_applications 조인)
// POST : { userId, jobId, preview? } — preview=true 면 발송 없이 메일 내용만 반환
// 수신자가 베트남 구직자이므로 메일은 베트남어 (notifyApplicantReceipt 와 동일 관례).

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com').replace(/\/$/, '')
const RESEND_FROM = process.env.RESEND_FROM || 'FYI <onboarding@resend.dev>'

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// 리멤버 공고 추천 메일 형식: 누가 보냈는지 → ■ 포지션 → 우선검토 안내 → 링크.
// 언어는 어드민이 모달에서 선택 (vi 기본).
const EMAIL_I18N = {
  vi: {
    fallbackName: 'bạn',
    subject: (c) => `[FYI] Nhà tuyển dụng ${c} đề xuất công việc cho bạn`,
    intro: (c, n) => `Nhà tuyển dụng của ${c} đã gửi đề xuất công việc đến ${n} thông qua FYI.`,
    positionLabel: 'Vị trí tuyển dụng',
    note: 'Khi ứng tuyển qua liên kết dưới đây, hồ sơ của bạn sẽ được đánh dấu riêng và được ưu tiên xem xét. Kết quả sẽ được thông báo qua email sau vòng xét duyệt hồ sơ.',
    noteHtml: (b) => `Khi ứng tuyển qua liên kết dưới đây, hồ sơ của bạn sẽ được ${b('đánh dấu riêng và được ưu tiên xem xét')}. Kết quả sẽ được thông báo qua email sau vòng xét duyệt hồ sơ.`,
    cta: 'Xem công việc & ứng tuyển →',
    footer: 'Đây là email tự động từ FYI (salary-fyi.com). Vui lòng không trả lời trực tiếp.',
  },
  ko: {
    fallbackName: '회원',
    subject: (c) => `[FYI] ${c} 채용 담당자의 공고 추천`,
    intro: (c, n) => `${c}의 채용 담당자가 FYI의 추천을 받아 ${n}님에게 공고를 보내왔습니다.`,
    positionLabel: '채용 포지션',
    note: '이 공고에 지원 시, 별도 표시되어 우선 검토 대상이 됩니다. 지원 결과는 서류 심사 후 안내됩니다.',
    noteHtml: (b) => `이 공고에 지원 시, ${b('별도 표시되어 우선 검토 대상')}이 됩니다. 지원 결과는 서류 심사 후 안내됩니다.`,
    cta: '공고 보고 지원하기 →',
    footer: '본 메일은 FYI(salary-fyi.com)에서 자동 발송되었습니다. 직접 회신하지 마세요.',
  },
  en: {
    fallbackName: 'you',
    subject: (c) => `[FYI] The recruiter at ${c} recommends a job for you`,
    intro: (c, n) => `The recruiter at ${c} has sent ${n} a job recommendation through FYI.`,
    positionLabel: 'Position',
    note: 'When you apply through the link below, your application will be specially marked and prioritized for review. Results will be shared after the resume screening.',
    noteHtml: (b) => `When you apply through the link below, your application will be ${b('specially marked and prioritized for review')}. Results will be shared after the resume screening.`,
    cta: 'View job & apply →',
    footer: 'This is an automated email from FYI (salary-fyi.com). Please do not reply directly.',
  },
}

function composeEmail({ name, job, lang }) {
  const t = EMAIL_I18N[lang] || EMAIL_I18N.vi
  const applicant = name || t.fallbackName
  const link = `${SITE_URL}/jobs/${job.id}?utm_source=fyi&utm_medium=email&utm_campaign=job_recommendation`
  const subject = t.subject(job.company)
  const text =
`${t.intro(job.company, applicant)}

■ ${t.positionLabel}:
${job.title}

${t.note}

${link}

— FYI (salary-fyi.com)`

  // HTML: 회색 배경 위 흰 카드(로고 헤더 → 인트로 → 공고 카드 → 우선검토 스트립 → CTA).
  // 이메일 클라이언트 호환을 위해 레이아웃은 table, 스타일은 전부 인라인.
  const b = (s) => `<b style="color:#111">${s}</b>`
  const companyInitial = escapeHtml((job.company || '?').trim()[0] || '?')
  const logoCell = job.logo_url
    ? `<img src="${escapeHtml(job.logo_url)}" alt="" width="44" height="44" style="width:44px;height:44px;border-radius:10px;object-fit:contain;background:#fff;border:1px solid #eef0f3;display:block">`
    : `<div style="width:44px;height:44px;border-radius:10px;background:#fff1e7;color:#ea580c;font-size:19px;font-weight:800;text-align:center;line-height:44px">${companyInitial}</div>`
  const html =
`<div style="background:#f4f5f8;padding:32px 16px;font-family:'Pretendard','Segoe UI',Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px">
      <tr><td style="background:#17181c;border-radius:16px 16px 0 0;padding:18px 30px">
        <img src="${SITE_URL}/logo.png" alt="FYI" height="28" style="height:28px;display:block">
      </td></tr>
      <tr><td style="background:#ffffff;border:1px solid #e9ecf0;border-top:none;border-radius:0 0 16px 16px;padding:30px 30px 34px">
        <div style="font-size:11px;font-weight:800;letter-spacing:1.5px;color:#ea580c;text-transform:uppercase;margin-bottom:10px">Job Recommendation</div>
        <p style="margin:0 0 22px;font-size:15px;line-height:1.65;color:#4b5563">${t.intro(`<b style="color:#111">${escapeHtml(job.company)}</b>`, `<b style="color:#111">${escapeHtml(applicant)}</b>`)}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fafbfc;border:1px solid #edf0f3;border-radius:12px">
          <tr>
            <td style="padding:18px 8px 18px 18px;width:44px;vertical-align:middle">${logoCell}</td>
            <td style="padding:18px 18px 18px 12px;vertical-align:middle">
              <div style="font-size:11px;font-weight:700;color:#9ca3af;margin-bottom:3px">${t.positionLabel}</div>
              <div style="font-size:17px;font-weight:800;color:#111;line-height:1.35">${escapeHtml(job.title)}</div>
              <div style="font-size:13px;color:#6b7280;margin-top:3px">${escapeHtml(job.company)}</div>
            </td>
          </tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 0">
          <tr><td style="background:#fff7ed;border-left:3px solid #ea580c;border-radius:0 8px 8px 0;padding:13px 16px;font-size:13.5px;line-height:1.6;color:#7c2d12">${t.noteHtml(b)}</td></tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 4px"><tr><td align="center">
          <a href="${link}" style="background:#ea580c;color:#ffffff;padding:14px 34px;border-radius:10px;text-decoration:none;font-weight:800;font-size:15px;display:inline-block">${escapeHtml(t.cta)}</a>
        </td></tr></table>
      </td></tr>
      <tr><td style="padding:20px 6px;text-align:center;font-size:12px;line-height:1.6;color:#9ca3af">
        ${t.footer}<br>
        <a href="${SITE_URL}" style="color:#9ca3af;text-decoration:underline">salary-fyi.com</a>
      </td></tr>
    </table>
  </td></tr></table>
</div>`
  return { subject, text, html }
}

async function handleGet(res) {
  const { data: recs, error } = await supabase
    .from('job_recommendations')
    .select('id, user_id, to_email, job_id, job_title, job_company, sent_by, status, created_at')
    .order('created_at', { ascending: false })
  // 마이그레이션(20260709) 미적용 환경에서도 인재풀 탭이 죽지 않게 빈 배열 반환
  if (error && /job_recommendations/.test(error.message || '')) return res.status(200).json([])
  if (error) return res.status(500).json({ error: error.message })

  // 실제 지원 여부: 같은 공고에 (로그인 user_id 일치) 또는 (지원서 이메일 일치)
  const jobIds = [...new Set(recs.map(r => r.job_id))]
  let apps = []
  if (jobIds.length > 0) {
    const { data } = await supabase
      .from('job_applications')
      .select('job_id, user_id, applicant_email, created_at')
      .in('job_id', jobIds)
    apps = data || []
  }
  const result = recs.map(r => {
    const applied = apps.find(a => a.job_id === r.job_id &&
      (a.user_id === r.user_id || (a.applicant_email && a.applicant_email.toLowerCase() === r.to_email.toLowerCase())))
    return { ...r, applied_at: applied?.created_at || null }
  })
  return res.status(200).json(result)
}

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') return handleGet(res)
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { userId, jobId, preview, lang = 'vi' } = req.body || {}
  if (!userId || !jobId) return res.status(400).json({ error: 'userId and jobId required' })
  if (!EMAIL_I18N[lang]) return res.status(400).json({ error: `unknown lang: ${lang}` })

  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .select('id, title, company, logo_url, is_active')
    .eq('id', jobId)
    .single()
  if (jobErr || !job) return res.status(404).json({ error: 'Job not found' })
  if (!job.is_active) return res.status(400).json({ error: 'Job is not active' })

  const { data: { user }, error: userErr } = await supabase.auth.admin.getUserById(userId)
  if (userErr || !user?.email) return res.status(404).json({ error: 'User email not found' })

  const { data: prof } = await supabase
    .from('user_profiles').select('full_name').eq('id', userId).maybeSingle()

  const email = composeEmail({ name: prof?.full_name, job, lang })
  if (preview) return res.status(200).json({ to: user.email, ...email })

  // 중복 발송 방지 — 이 조회는 로그 테이블 존재 검증도 겸한다 (발송 전에 실패시켜
  // 기록 없는 메일이 나가는 걸 막는다).
  const { data: dup, error: dupErr } = await supabase
    .from('job_recommendations')
    .select('id')
    .eq('user_id', userId)
    .eq('job_id', jobId)
    .maybeSingle()
  if (dupErr) {
    const msg = /job_recommendations/.test(dupErr.message || '')
      ? 'job_recommendations 테이블 없음 — supabase/migrations/20260709_job_recommendations.sql 을 먼저 적용하세요'
      : dupErr.message
    return res.status(500).json({ error: msg })
  }
  if (dup) return res.status(409).json({ error: 'already_sent' })

  let status = 'sent'
  try {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    const r = await resend.emails.send({ from: RESEND_FROM, to: user.email, subject: email.subject, text: email.text, html: email.html })
    if (r.error) throw new Error(r.error.message || 'resend_error')
  } catch (e) {
    return res.status(500).json({ error: `발송 실패: ${e.message}` })
  }

  const { data: row, error: insErr } = await supabase
    .from('job_recommendations')
    .insert({
      user_id: userId,
      to_email: user.email,
      job_id: job.id,
      job_title: job.title,
      job_company: job.company,
      sent_by: admin.email || null,
      status,
    })
    .select('id, user_id, to_email, job_id, job_title, job_company, sent_by, status, created_at')
    .single()
  // 발송은 이미 성공 — 로그 실패는 경고로만 전달
  if (insErr) return res.status(200).json({ success: true, to: user.email, warning: `발송됨, 로그 실패: ${insErr.message}` })

  return res.status(201).json({ success: true, to: user.email, recommendation: { ...row, applied_at: null } })
}
