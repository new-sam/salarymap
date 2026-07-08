// 채용팀/기업 담당자 대상 자동 트리거 메일들 (베트남어 + CTA).
// pages/api 에서 재사용하고 scripts/test-all-emails.mjs 에서도 개별 발송 테스트.

const RESEND_FROM = process.env.RESEND_FROM || 'FYI for Companies <onboarding@resend.dev>';

const ROLE_LABEL = { admin: 'Quản trị tin tuyển dụng', interviewer: 'Người phỏng vấn' };

// 신규 유저 초대 메일 — 가입 유도.
export async function sendInviteMail({ toEmail, companyName, inviterEmail, jobTitle, link, role }) {
  if (!process.env.RESEND_API_KEY) return { ok: false, reason: 'no_resend_key' };
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const roleLabel = ROLE_LABEL[role];
    const subject = `[FYI] Bạn được mời vào nhóm tuyển dụng của ${companyName} (${roleLabel})`;
    const roleBlurb = role === 'admin'
      ? `Bạn được mời với vai trò ${roleLabel}. Vai trò này bao gồm quyền chỉnh sửa tin tuyển dụng, mời thành viên, chuyển ứng viên sang vòng tiếp theo và gửi email trúng tuyển/loại.`
      : `Bạn được mời với vai trò ${roleLabel}. Vai trò này cho phép xem hồ sơ ứng viên và viết đánh giá.`;
    const text =
`${inviterEmail} đã mời bạn tham gia nhóm tuyển dụng (${jobTitle}) của ${companyName} với vai trò ${roleLabel}.

${roleBlurb}

Vui lòng đăng ký qua liên kết dưới đây để tự động tham gia nhóm tuyển dụng:
${link}

— FYI for Companies`;
    const html =
`<div style="font-family:'Pretendard',Arial,sans-serif;color:#111;max-width:520px">
  <h2 style="font-size:20px;margin:0 0 12px">Lời mời tham gia nhóm tuyển dụng ${companyName} · ${roleLabel}</h2>
  <p style="line-height:1.6;color:#374151">${inviterEmail} đã mời bạn tham gia nhóm tuyển dụng <b>${jobTitle}</b> với vai trò <b>${roleLabel}</b>.</p>
  <p style="line-height:1.6;color:#374151">${roleBlurb}</p>
  <p style="margin:24px 0"><a href="${link}" style="background:#ea580c;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:800">Đăng ký và tham gia nhóm →</a></p>
  <p style="font-size:12px;color:#9ca3af">Liên kết: ${link}</p>
</div>`;
    const r = await resend.emails.send({ from: RESEND_FROM, to: toEmail, replyTo: inviterEmail || undefined, subject, text, html });
    if (r.error) return { ok: false, reason: r.error.message || 'resend_error' };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e?.message || 'send_failed' };
  }
}

// 같은 회사에 이미 가입된 멤버를 팀에 추가했을 때 보내는 알림.
export async function sendMemberAddedMail({ toEmail, companyName, inviterEmail, jobTitle, link, role }) {
  if (!process.env.RESEND_API_KEY) return { ok: false, reason: 'no_resend_key' };
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const roleLabel = ROLE_LABEL[role];
    const subject = `[FYI] Bạn đã được thêm vào nhóm tuyển dụng ${jobTitle} của ${companyName} (${roleLabel})`;
    const roleBlurb = role === 'admin'
      ? `Bạn được thêm với vai trò ${roleLabel}. Vai trò này bao gồm quyền chỉnh sửa tin tuyển dụng, mời thành viên, chuyển ứng viên sang vòng tiếp theo và gửi email trúng tuyển/loại.`
      : `Bạn được thêm với vai trò ${roleLabel}. Vai trò này cho phép xem hồ sơ ứng viên và viết đánh giá.`;
    const text =
`${inviterEmail} đã thêm bạn vào nhóm tuyển dụng (${jobTitle}) của ${companyName} với vai trò ${roleLabel}.

${roleBlurb}

Vì bạn đã có tài khoản, bạn được tham gia ngay mà không cần đăng ký lại. Xem danh sách ứng viên tại:
${link}

— FYI for Companies`;
    const html =
`<div style="font-family:'Pretendard',Arial,sans-serif;color:#111;max-width:520px">
  <h2 style="font-size:20px;margin:0 0 12px">Bạn đã tham gia nhóm tuyển dụng ${companyName} · ${roleLabel}</h2>
  <p style="line-height:1.6;color:#374151">${inviterEmail} đã thêm bạn vào nhóm tuyển dụng <b>${jobTitle}</b> với vai trò <b>${roleLabel}</b>.</p>
  <p style="line-height:1.6;color:#374151">${roleBlurb}</p>
  <p style="line-height:1.6;color:#374151">Vì bạn đã có tài khoản, bạn được tham gia ngay mà không cần đăng ký lại.</p>
  <p style="margin:24px 0"><a href="${link}" style="background:#ea580c;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:800">Xem ứng viên →</a></p>
  <p style="font-size:12px;color:#9ca3af">Liên kết: ${link}</p>
</div>`;
    const r = await resend.emails.send({ from: RESEND_FROM, to: toEmail, replyTo: inviterEmail || undefined, subject, text, html });
    if (r.error) return { ok: false, reason: r.error.message || 'resend_error' };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e?.message || 'send_failed' };
  }
}

// 공고 승인 알림 메일.
export async function sendJobApprovedMail({ toEmail, jobTitle, companyName }) {
  if (!process.env.RESEND_API_KEY) return { ok: false, reason: 'no_resend_key' };
  try {
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com').replace(/\/$/, '');
    const jobUrl = `${siteUrl}/company/jobs`;
    const subject = `[FYI] Tin tuyển dụng đã được duyệt và đăng — ${jobTitle}`;
    const text = `Tin tuyển dụng "${jobTitle}" (${companyName}) đã vượt qua bước duyệt và được đăng thành công.\n\nXem tin tuyển dụng của bạn:\n${jobUrl}\n\n— FYI for Companies`;
    const html =
`<div style="font-family:'Pretendard','Segoe UI',Arial,sans-serif;color:#111;max-width:520px;margin:0 auto;padding:8px 0">
  <h2 style="font-size:20px;margin:0 0 12px">Tin tuyển dụng đã được đăng ✅</h2>
  <p style="line-height:1.6;color:#374151">Tin tuyển dụng <b>${jobTitle}</b> (${companyName}) đã vượt qua bước duyệt và được đăng thành công.</p>
  <p style="margin:24px 0"><a href="${jobUrl}" style="background:#ea580c;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:800;display:inline-block">Xem tin tuyển dụng →</a></p>
  <p style="font-size:12px;color:#9ca3af;margin-top:24px">Đây là email tự động. Vui lòng không trả lời trực tiếp.</p>
</div>`;
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const r = await resend.emails.send({ from: RESEND_FROM, to: toEmail, subject, text, html });
    if (r.error) return { ok: false, reason: r.error.message || 'resend_error' };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e?.message || 'send_failed' };
  }
}
