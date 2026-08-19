// 지원자에게 서류 불합격 안내 메일 (베트남어 + CTA → 다른 공고 탐색).
// - KTC 스크리닝 동기화(syncFyiRejections)·어드민 수동 불합격(api/admin/applications.js)이 호출.
// - 2026-08-13 이후 접수된 지원 건만 대상 (게이트는 콜사이트에서 REJECTION_EMAIL_SINCE 로).
// - recruiter_mail_log 에 template_key='applicant_rejection' 기록, 기발송 지원 건은 스킵 (1회만).
// - 절대 throw 하지 않는다.

import supabaseAdmin from './supabaseAdmin.js';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com').replace(/\/$/, '');
const RESEND_FROM = process.env.RESEND_FROM || 'FYI <onboarding@resend.dev>';

// 이 시각(ICT) 이후 접수된 지원 건부터 불합격 메일 발송 — 이전 건은 화면 표시만.
export const REJECTION_EMAIL_SINCE = '2026-08-13T00:00:00+07:00';

// 2026-08-19 발송 중단 — 상태 동기화(스텝퍼 표시)는 그대로, 메일만 끈다. 재개하려면 false.
const REJECTION_EMAIL_DISABLED = true;

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export async function notifyApplicantRejection(applicationId) {
  if (REJECTION_EMAIL_DISABLED) return { ok: false, reason: 'disabled' };
  if (!applicationId) return { ok: false, reason: 'no_id' };
  if (!process.env.RESEND_API_KEY) return { ok: false, reason: 'no_resend_key' };

  try {
    // 1) 지원 상세 — 불합격 상태가 아니면 보내지 않는다 (되돌린 직후 등)
    const { data: app } = await supabaseAdmin
      .from('job_applications')
      .select('id, applicant_name, applicant_email, job_title, job_company, user_id, status, rejected_at')
      .eq('id', applicationId)
      .maybeSingle();
    if (!app) return { ok: false, reason: 'app_not_found' };
    if (app.status !== 'rejected' && !app.rejected_at) return { ok: false, reason: 'not_rejected' };

    // 2) 기발송 dedup — 지원건당 1회만
    const { data: prior } = await supabaseAdmin
      .from('recruiter_mail_log')
      .select('id')
      .eq('application_id', app.id)
      .eq('template_key', 'applicant_rejection')
      .eq('status', 'sent')
      .limit(1);
    if (prior?.length) return { ok: false, reason: 'already_sent' };

    // 3) 수신 이메일 — applicant_email 우선, 없으면 로그인 유저 프로필에서 fallback
    let toEmail = app.applicant_email || null;
    if (!toEmail && app.user_id) {
      const { data: prof } = await supabaseAdmin
        .from('user_profiles').select('email').eq('id', app.user_id).maybeSingle();
      toEmail = prof?.email || null;
    }
    const override = (process.env.APPLICANT_REJECTION_OVERRIDE_TO || '').trim();
    if (override) toEmail = override;
    if (!toEmail) return { ok: false, reason: 'no_recipient' };

    // 4) 콘텐츠
    const applicantName = app.applicant_name || 'bạn';
    const jobTitle = app.job_title || 'vị trí ứng tuyển';
    const companyName = app.job_company || 'nhà tuyển dụng';
    const ctaUrl = `${SITE_URL}/jobs`;

    const subject = `[FYI] Kết quả hồ sơ ứng tuyển ${jobTitle} — ${companyName}`;
    const text =
`Xin chào ${applicantName},

Cảm ơn bạn đã ứng tuyển vị trí ${jobTitle} tại ${companyName} và dành thời gian cho quá trình này.

Rất tiếc, sau khi xem xét kỹ hồ sơ, nhà tuyển dụng đã quyết định không tiếp tục với hồ sơ của bạn cho vị trí này.

Kết quả này không phản ánh hết năng lực của bạn — hồ sơ của bạn vẫn được lưu trên FYI và nhiều vị trí phù hợp khác đang tuyển. Đừng bỏ lỡ:
${ctaUrl}

Chúc bạn sớm tìm được công việc như ý.

— FYI (salary-fyi.com)`;

    const html =
`<div style="font-family:'Pretendard','Segoe UI',Arial,sans-serif;color:#111;max-width:560px;margin:0 auto;padding:8px 0">
  <h2 style="font-size:20px;margin:0 0 12px;color:#111">Kết quả hồ sơ ứng tuyển</h2>
  <p style="margin:0 0 12px;line-height:1.6;color:#374151">Xin chào <b>${escapeHtml(applicantName)}</b>,</p>
  <p style="margin:0 0 12px;line-height:1.6;color:#374151">Cảm ơn bạn đã ứng tuyển vị trí <b>${escapeHtml(jobTitle)}</b> tại <b>${escapeHtml(companyName)}</b> và dành thời gian cho quá trình này.</p>
  <p style="margin:0 0 12px;line-height:1.6;color:#374151">Rất tiếc, sau khi xem xét kỹ hồ sơ, nhà tuyển dụng đã quyết định <b>không tiếp tục</b> với hồ sơ của bạn cho vị trí này.</p>
  <p style="margin:0 0 16px;line-height:1.6;color:#374151">Kết quả này không phản ánh hết năng lực của bạn — hồ sơ của bạn vẫn được lưu trên FYI và nhiều vị trí phù hợp khác đang tuyển.</p>
  <p style="margin:24px 0"><a href="${ctaUrl}" style="background:#ea580c;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:800;display:inline-block">Xem việc làm đang tuyển →</a></p>
  <p style="font-size:12px;color:#9ca3af;margin-top:24px">Đây là email tự động. Vui lòng không trả lời trực tiếp.</p>
</div>`;

    // 5) 발송
    let status = 'sent';
    let err = null;
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const r = await resend.emails.send({ from: RESEND_FROM, to: toEmail, subject, text, html });
      if (r.error) { status = 'failed'; err = r.error.message || 'resend_error'; }
    } catch (e) {
      status = 'failed';
      err = e?.message || 'send_failed';
    }

    // 6) 로그
    try {
      await supabaseAdmin.from('recruiter_mail_log').insert({
        application_id: app.id,
        to_email: toEmail,
        subject,
        body: text,
        template_key: 'applicant_rejection',
        sent_by: null,
        status,
      });
    } catch (_) {}

    if (status !== 'sent') return { ok: false, reason: err };
    return { ok: true, to: toEmail };
  } catch (e) {
    console.error('[notifyApplicantRejection]', e?.message || e);
    return { ok: false, reason: e?.message || 'error' };
  }
}
