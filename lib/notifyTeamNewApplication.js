// 지원 접수 → 채용팀(job_team 전원 + 오너) 자동 알림 메일.
// - 지원자가 job_applications 에 insert 된 직후 fire-and-forget 으로 호출.
// - 절대 throw 하지 않는다 (지원 자체가 실패로 처리되지 않게).
// - NOTIFY_TEAM_OVERRIDE_TO 가 설정되면 모든 수신자를 그 주소 하나로 리다이렉트 (테스트/프리뷰용).
// - 각 수신자별로 개별 발송 (다른 수신자 이메일 노출 방지) + recruiter_mail_log 에 개별 기록.

import supabaseAdmin from './supabaseAdmin.js';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com').replace(/\/$/, '');
const RESEND_FROM = process.env.RESEND_FROM || 'FYI for Companies <onboarding@resend.dev>';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatAppliedAt(iso) {
  try {
    return new Date(iso || Date.now()).toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return new Date().toISOString();
  }
}

export async function notifyTeamNewApplication(applicationId) {
  if (!applicationId) return { ok: false, reason: 'no_id' };
  if (!process.env.RESEND_API_KEY) return { ok: false, reason: 'no_resend_key' };

  try {
    // 1) 지원 상세
    const { data: app } = await supabaseAdmin
      .from('job_applications')
      .select('id, applicant_name, applicant_email, job_id, job_title, job_company, created_at')
      .eq('id', applicationId)
      .maybeSingle();
    if (!app || !app.job_id) return { ok: false, reason: 'app_not_found' };

    // 2) 공고 (오너 fallback, title/company 보강)
    const { data: job } = await supabaseAdmin
      .from('jobs')
      .select('id, title, company, created_by')
      .eq('id', app.job_id)
      .maybeSingle();

    // 3) job_team 전원 + 오너
    const { data: team } = await supabaseAdmin
      .from('job_team')
      .select('user_id')
      .eq('job_id', app.job_id);
    const userIds = new Set((team || []).map(r => r.user_id).filter(Boolean));
    if (job?.created_by) userIds.add(job.created_by);
    if (userIds.size === 0) return { ok: false, reason: 'no_team' };

    // 4) user_id → email
    const { data: rus } = await supabaseAdmin
      .from('recruiter_users')
      .select('user_id, email')
      .in('user_id', Array.from(userIds));
    let toEmails = Array.from(new Set((rus || []).map(r => r.email).filter(Boolean)));

    // 5) 테스트 override — 모든 수신을 override 주소 하나로.
    const override = (process.env.NOTIFY_TEAM_OVERRIDE_TO || '').trim();
    if (override) toEmails = [override];

    if (!toEmails.length) return { ok: false, reason: 'no_recipients' };

    // 6) 이메일 콘텐츠 (베트남어) + CTA → 후보 상세
    const applicantName = app.applicant_name || 'Ứng viên';
    const jobTitle = app.job_title || job?.title || 'vị trí';
    const companyName = app.job_company || job?.company || 'công ty của bạn';
    const applicantEmail = app.applicant_email || '';
    const appliedAt = formatAppliedAt(app.created_at);
    const ctaUrl = `${SITE_URL}/company/candidates/${app.id}`;

    const subject = `[FYI] ${applicantName} đã ứng tuyển vị trí ${jobTitle}`;
    const text =
`${applicantName} vừa ứng tuyển vị trí ${jobTitle} tại ${companyName}.

Họ tên:    ${applicantName}
Email:     ${applicantEmail || '-'}
Ngày nộp:  ${appliedAt}

Xem hồ sơ ứng viên ngay:
${ctaUrl}

— FYI for Companies`;

    const html =
`<div style="font-family:'Pretendard','Segoe UI',Arial,sans-serif;color:#111;max-width:560px;margin:0 auto;padding:8px 0">
  <h2 style="font-size:20px;margin:0 0 12px;color:#111">Đơn ứng tuyển mới</h2>
  <p style="margin:0 0 16px;line-height:1.6;color:#374151"><b>${escapeHtml(applicantName)}</b> vừa ứng tuyển vị trí <b>${escapeHtml(jobTitle)}</b> tại ${escapeHtml(companyName)}.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;color:#374151">
    <tr><td style="padding:6px 0;width:120px;color:#6b7280">Họ tên</td><td style="padding:6px 0"><b>${escapeHtml(applicantName)}</b></td></tr>
    <tr><td style="padding:6px 0;color:#6b7280">Email</td><td style="padding:6px 0">${escapeHtml(applicantEmail || '-')}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280">Ngày nộp</td><td style="padding:6px 0">${escapeHtml(appliedAt)}</td></tr>
  </table>
  <p style="margin:24px 0"><a href="${ctaUrl}" style="background:#ea580c;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:800;display:inline-block">Xem hồ sơ ứng viên →</a></p>
  <p style="font-size:12px;color:#9ca3af;margin-top:24px">Đây là email tự động. Vui lòng không trả lời trực tiếp.</p>
</div>`;

    // 7) 개별 발송 (수신자 간 이메일 노출 방지) + 개별 로그 기록
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    const results = await Promise.all(toEmails.map(async (to) => {
      let status = 'sent';
      let err = null;
      try {
        const r = await resend.emails.send({ from: RESEND_FROM, to, subject, text, html });
        if (r.error) { status = 'failed'; err = r.error.message || 'resend_error'; }
      } catch (e) {
        status = 'failed';
        err = e?.message || 'send_failed';
      }
      try {
        await supabaseAdmin.from('recruiter_mail_log').insert({
          application_id: app.id,
          to_email: to,
          subject,
          body: text,
          template_key: 'team_new_application',
          sent_by: null,
          status,
        });
      } catch (_) {}
      return { to, status, err };
    }));

    const sent = results.filter(r => r.status === 'sent').length;
    return { ok: sent > 0, sent, total: toEmails.length, results };
  } catch (e) {
    console.error('[notifyTeamNewApplication]', e?.message || e);
    return { ok: false, reason: e?.message || 'error' };
  }
}
