import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_FROM = process.env.RESEND_FROM || 'FYI <onboarding@resend.dev>';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildInviteLink(req, jobId) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  // 받는 사람이 이 링크로 가입 → /auth/callback 에서 email 매칭해 job_team 연결(추후)
  return `${proto}://${host}/company?invite=${jobId}`;
}

async function sendInviteMail({ toEmail, companyName, inviterEmail, jobTitle, link }) {
  if (!process.env.RESEND_API_KEY) return { ok: false, reason: 'no_resend_key' };
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const subject = `[FYI] ${companyName} 채용팀에서 함께 면접 봐달라고 요청했어요`;
    const text =
`${inviterEmail} 님이 ${companyName}의 채용팀에 당신을 초대했습니다.
공고: ${jobTitle}

가입 링크 (이 이메일로 가입하면 자동 합류):
${link}

— FYI for Companies
salary-fyi.com`;
    const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8" /><title>FYI 채용팀 초대</title></head><body style="margin:0;padding:0;background:#f4f4f5">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;font-family:'Pretendard',-apple-system,'Apple SD Gothic Neo','Segoe UI',Arial,sans-serif;color:#111">

    <!-- Brand -->
    <div style="margin-bottom:28px">
      <span style="font-weight:950;letter-spacing:-.04em;font-size:22px;color:#ea580c">FYI</span>
      <span style="font-size:12px;color:#9ca3af;margin-left:8px">베트남 IT 채용</span>
    </div>

    <!-- Card -->
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:32px 28px;box-shadow:0 1px 2px rgba(0,0,0,.04)">
      <div style="font-size:12px;font-weight:800;color:#ea580c;letter-spacing:.06em;margin-bottom:10px">CHÚC MỪNG · 채용팀 초대</div>
      <h1 style="margin:0 0 14px;font-size:23px;line-height:1.32;letter-spacing:-.02em">${escapeHtml(companyName)} 채용팀에서<br/>같이 면접 봐달라고 합니다.</h1>
      <p style="margin:0 0 22px;font-size:14px;line-height:1.65;color:#4b5563"><b style="color:#111">${escapeHtml(inviterEmail)}</b> 님이 <b style="color:#111">${escapeHtml(jobTitle)}</b> 공고의 면접관으로 당신을 추가했어요. 아래 버튼으로 가입만 하면 그 공고의 채용 보드가 바로 열립니다.</p>

      <!-- CTA -->
      <table cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 22px">
        <tr><td style="background:linear-gradient(135deg,#ef4444,#f97316);border-radius:10px">
          <a href="${link}" style="display:inline-block;padding:13px 22px;color:#fff;font-size:14.5px;font-weight:900;text-decoration:none">가입하고 채용팀 합류하기 →</a>
        </td></tr>
      </table>

      <!-- Steps -->
      <div style="margin-top:18px;background:#fafafa;border:1px solid #f1f1f1;border-radius:10px;padding:14px 16px">
        <div style="font-size:11.5px;font-weight:900;color:#6b7280;letter-spacing:.04em;margin-bottom:8px">합류 절차</div>
        <ol style="margin:0;padding-left:18px;color:#374151;font-size:13px;line-height:1.7">
          <li>위 버튼으로 가입 (이 이메일 그대로)</li>
          <li>가입 직후 자동으로 채용팀에 합류</li>
          <li>지원자 보고, 단계 옮기고, 메모 남기기</li>
        </ol>
      </div>

      <p style="margin:22px 0 0;font-size:11.5px;color:#9ca3af;line-height:1.6">버튼이 안 보이면 다음 링크: <a href="${link}" style="color:#6b7280;word-break:break-all">${link}</a></p>
    </div>

    <p style="margin:18px 6px 0;font-size:11px;color:#9ca3af;line-height:1.6">이 메일은 ${escapeHtml(inviterEmail)} 님이 당신을 채용팀에 초대해서 발송됐습니다. 모르는 초대라면 이 메일을 무시하시면 됩니다.</p>
  </div>
</body></html>`;
    const r = await resend.emails.send({ from: RESEND_FROM, to: toEmail, replyTo: inviterEmail || undefined, subject, text, html });
    if (r.error) return { ok: false, reason: r.error.message || 'resend_error' };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message || 'send_failed' };
  }
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SERVICE_KEY) return res.status(503).json({ error: '서버 설정 누락' });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });

  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return res.status(401).json({ error: '세션이 만료되었습니다.' });

  const { email, role, jobId } = req.body || {};
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(cleanEmail)) return res.status(400).json({ error: '올바른 이메일을 입력해 주세요.' });
  if (!jobId) return res.status(400).json({ error: 'jobId 필요' });
  const cleanRole = role === 'admin' ? 'admin' : 'member';

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: rec } = await admin
    .from('recruiter_users').select('company_id, recruiter_companies(name)').eq('user_id', user.id).maybeSingle();
  if (!rec?.company_id) return res.status(403).json({ error: '회사 정보가 없습니다.' });
  const companyName = rec.recruiter_companies?.name || '귀사';

  const { data: job } = await admin
    .from('jobs').select('id, title, created_by, company_id').eq('id', jobId).maybeSingle();
  if (!job || job.company_id !== rec.company_id) return res.status(403).json({ error: '해당 공고 권한 없음' });
  if (job.created_by && job.created_by !== user.id) {
    return res.status(403).json({ error: '오너만 팀원을 초대할 수 있습니다.' });
  }

  // 이미 회사 멤버?
  const { data: existing } = await admin
    .from('recruiter_users')
    .select('user_id, email, full_name')
    .eq('company_id', rec.company_id)
    .ilike('email', cleanEmail)
    .maybeSingle();

  if (existing?.user_id) {
    const { error: e } = await admin
      .from('job_team')
      .upsert({
        job_id: jobId,
        user_id: existing.user_id,
        role: 'interviewer',
        added_by: user.id,
      }, { onConflict: 'job_id,user_id' });
    if (e) return res.status(500).json({ error: '추가 실패: ' + e.message });
    return res.status(200).json({
      success: true,
      addedDirectly: true,
      mailSent: false,
      memberName: existing.full_name || existing.email,
    });
  }

  // 외부 이메일 → recruiter_invites + 메일 발송 시도
  const { error: insErr } = await admin
    .from('recruiter_invites')
    .insert({
      company_id: rec.company_id,
      email: cleanEmail,
      role: cleanRole,
      job_id: jobId,
      invited_by: user.id,
      status: 'pending',
    });
  if (insErr && !String(insErr.message || '').match(/duplicate|unique/i)) {
    return res.status(500).json({ error: '초대 저장 실패: ' + insErr.message });
  }

  const link = buildInviteLink(req, jobId);
  const mailResult = await sendInviteMail({
    toEmail: cleanEmail,
    companyName,
    inviterEmail: user.email,
    jobTitle: job.title,
    link,
  });

  return res.status(200).json({
    success: true,
    addedDirectly: false,
    mailSent: !!mailResult.ok,
    mailErrorReason: mailResult.ok ? null : mailResult.reason,
    inviteLink: link,
  });
}
