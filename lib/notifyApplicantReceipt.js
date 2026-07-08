// 지원자에게 접수 확인 메일 자동 발송 (베트남어 + CTA → /my-applications).
// - job_applications insert 직후 호출.
// - 절대 throw 하지 않는다 (지원 자체가 실패로 처리되지 않게).
// - APPLICANT_RECEIPT_OVERRIDE_TO 로 테스트 override.
// - recruiter_mail_log 에 template_key='applicant_receipt' 로 기록.

import supabaseAdmin from './supabaseAdmin.js';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com').replace(/\/$/, '');
const RESEND_FROM = process.env.RESEND_FROM || 'FYI <onboarding@resend.dev>';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export async function notifyApplicantReceipt(applicationId) {
  if (!applicationId) return { ok: false, reason: 'no_id' };
  if (!process.env.RESEND_API_KEY) return { ok: false, reason: 'no_resend_key' };

  try {
    // 1) 지원 상세
    const { data: app } = await supabaseAdmin
      .from('job_applications')
      .select('id, applicant_name, applicant_email, job_title, job_company, user_id')
      .eq('id', applicationId)
      .maybeSingle();
    if (!app) return { ok: false, reason: 'app_not_found' };

    // 2) 수신 이메일 — applicant_email 우선, 없으면 로그인 유저 프로필에서 fallback
    let toEmail = app.applicant_email || null;
    if (!toEmail && app.user_id) {
      const { data: prof } = await supabaseAdmin
        .from('user_profiles').select('email').eq('id', app.user_id).maybeSingle();
      toEmail = prof?.email || null;
    }

    // 테스트 override
    const override = (process.env.APPLICANT_RECEIPT_OVERRIDE_TO || '').trim();
    if (override) toEmail = override;

    if (!toEmail) return { ok: false, reason: 'no_recipient' };

    // 3) 콘텐츠
    const applicantName = app.applicant_name || 'bạn';
    const jobTitle = app.job_title || 'vị trí ứng tuyển';
    const companyName = app.job_company || 'nhà tuyển dụng';
    const ctaUrl = `${SITE_URL}/my-applications`;

    const subject = `[FYI] Đã nhận hồ sơ ứng tuyển ${jobTitle} — ${companyName}`;
    const text =
`Xin chào ${applicantName},

Cảm ơn bạn đã ứng tuyển vị trí ${jobTitle} tại ${companyName}.
Chúng tôi đã nhận được hồ sơ của bạn và đang chuyển tới nhà tuyển dụng.
Kết quả sẽ được thông báo qua email này ngay khi có.

Xem trạng thái ứng tuyển của bạn:
${ctaUrl}

— FYI (salary-fyi.com)`;

    const html =
`<div style="font-family:'Pretendard','Segoe UI',Arial,sans-serif;color:#111;max-width:560px;margin:0 auto;padding:8px 0">
  <h2 style="font-size:20px;margin:0 0 12px;color:#111">Đã nhận hồ sơ của bạn ✅</h2>
  <p style="margin:0 0 12px;line-height:1.6;color:#374151">Xin chào <b>${escapeHtml(applicantName)}</b>,</p>
  <p style="margin:0 0 16px;line-height:1.6;color:#374151">Cảm ơn bạn đã ứng tuyển vị trí <b>${escapeHtml(jobTitle)}</b> tại <b>${escapeHtml(companyName)}</b>. Chúng tôi đã nhận được hồ sơ của bạn và đang chuyển tới nhà tuyển dụng. Kết quả sẽ được thông báo qua email này ngay khi có.</p>
  <p style="margin:24px 0"><a href="${ctaUrl}" style="background:#ea580c;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:800;display:inline-block">Xem trạng thái ứng tuyển →</a></p>
  <p style="font-size:12px;color:#9ca3af;margin-top:24px">Đây là email tự động. Vui lòng không trả lời trực tiếp.</p>
</div>`;

    // 4) 발송
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

    // 5) 로그
    try {
      await supabaseAdmin.from('recruiter_mail_log').insert({
        application_id: app.id,
        to_email: toEmail,
        subject,
        body: text,
        template_key: 'applicant_receipt',
        sent_by: null,
        status,
      });
    } catch (_) {}

    if (status !== 'sent') return { ok: false, reason: err };
    return { ok: true, to: toEmail };
  } catch (e) {
    console.error('[notifyApplicantReceipt]', e?.message || e);
    return { ok: false, reason: e?.message || 'error' };
  }
}
