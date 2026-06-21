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

// 이미 회사 계정이 있는 사람은 가입 단계 없이 곧바로 ATS 로 보낸다.
function buildAtsLink(req, jobId) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  return `${proto}://${host}/company/ats?jobId=${jobId}`;
}

async function sendInviteMail({ toEmail, companyName, inviterEmail, jobTitle, link }) {
  if (!process.env.RESEND_API_KEY) return { ok: false, reason: 'no_resend_key' };
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const subject = `[FYI] ${companyName} 채용팀에 초대됐어요`;
    const text =
`${inviterEmail} 님이 ${companyName}의 채용팀(${jobTitle})에 당신을 초대했습니다.

아래 링크에서 가입하시면 자동으로 채용팀에 합류됩니다:
${link}

— FYI for Companies`;
    const html =
`<div style="font-family:'Pretendard',Arial,sans-serif;color:#111;max-width:520px">
  <h2 style="font-size:20px;margin:0 0 12px">${companyName} 채용팀 초대</h2>
  <p style="line-height:1.6;color:#374151">${inviterEmail} 님이 <b>${jobTitle}</b> 채용팀에 당신을 초대했습니다.</p>
  <p style="margin:24px 0"><a href="${link}" style="background:#ea580c;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:800">가입하고 팀 합류 →</a></p>
  <p style="font-size:12px;color:#9ca3af">링크: ${link}</p>
</div>`;
    const r = await resend.emails.send({ from: RESEND_FROM, to: toEmail, replyTo: inviterEmail || undefined, subject, text, html });
    if (r.error) return { ok: false, reason: r.error.message || 'resend_error' };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message || 'send_failed' };
  }
}

// 같은 회사에 이미 가입된 멤버를 면접관으로 추가했을 때 보내는 알림 메일.
// 가입 단계 없이 ATS로 바로 들어갈 수 있게 메시지/링크가 다르다.
async function sendMemberAddedMail({ toEmail, companyName, inviterEmail, jobTitle, link }) {
  if (!process.env.RESEND_API_KEY) return { ok: false, reason: 'no_resend_key' };
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const subject = `[FYI] ${companyName} ${jobTitle} 채용팀에 합류됐어요`;
    const text =
`${inviterEmail} 님이 ${companyName}의 채용팀(${jobTitle})에 당신을 면접관으로 추가했습니다.

이미 가입된 계정이라 별도 가입 없이 바로 합류됐어요. 아래 링크에서 지원자 현황을 확인할 수 있습니다:
${link}

— FYI for Companies`;
    const html =
`<div style="font-family:'Pretendard',Arial,sans-serif;color:#111;max-width:520px">
  <h2 style="font-size:20px;margin:0 0 12px">${companyName} 채용팀 합류</h2>
  <p style="line-height:1.6;color:#374151">${inviterEmail} 님이 <b>${jobTitle}</b> 채용팀에 당신을 면접관으로 추가했습니다.</p>
  <p style="line-height:1.6;color:#374151">이미 가입된 계정이라 별도 가입 없이 바로 합류됐어요.</p>
  <p style="margin:24px 0"><a href="${link}" style="background:#ea580c;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:800">지원자 보러 가기 →</a></p>
  <p style="font-size:12px;color:#9ca3af">링크: ${link}</p>
</div>`;
    const r = await resend.emails.send({ from: RESEND_FROM, to: toEmail, replyTo: inviterEmail || undefined, subject, text, html });
    if (r.error) return { ok: false, reason: r.error.message || 'resend_error' };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message || 'send_failed' };
  }
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
    // 이미 같은 회사에 가입된 멤버 → job_team 직접 추가하지만, 사용자가
    // "자기가 면접관으로 추가됐다"는 사실을 모르고 지나치지 않도록 알림
    // 메일도 함께 발송하고, 감사용으로 recruiter_invites 에도 accepted
    // 상태로 기록을 남긴다.
    const { error: e } = await admin
      .from('job_team')
      .upsert({
        job_id: jobId,
        user_id: existing.user_id,
        role: 'interviewer',
        added_by: user.id,
      }, { onConflict: 'job_id,user_id' });
    if (e) return res.status(500).json({ error: '추가 실패: ' + e.message });

    // 감사 기록 — duplicate 는 무시 (이미 한 번 초대된 같은 이메일일 수 있음)
    const { error: invErr } = await admin
      .from('recruiter_invites')
      .insert({
        company_id: rec.company_id,
        email: cleanEmail,
        role: cleanRole,
        job_id: jobId,
        invited_by: user.id,
        status: 'accepted',
      });
    if (invErr && !String(invErr.message || '').match(/duplicate|unique/i)) {
      // 메일/UI는 막지 않고 로그만 — recruiter_invites 컬럼 정책이 환경별로
      // 다를 수 있어 hard fail 시키지 않는다.
      console.error('invite audit log failed (existing member):', invErr.message);
    }

    const link = buildAtsLink(req, jobId);
    const mailResult = await sendMemberAddedMail({
      toEmail: cleanEmail,
      companyName,
      inviterEmail: user.email,
      jobTitle: job.title,
      link,
    });

    return res.status(200).json({
      success: true,
      addedDirectly: true,
      mailSent: !!mailResult.ok,
      mailErrorReason: mailResult.ok ? null : mailResult.reason,
      memberName: existing.full_name || existing.email,
      inviteLink: link,
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
