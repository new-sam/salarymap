import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_FROM = process.env.RESEND_FROM || 'FYI for Companies <onboarding@resend.dev>';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(503).json({ error: '메일 서비스가 아직 설정되지 않았습니다. (RESEND_API_KEY 누락)' });
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });

  const { appId, subject, body, templateKey } = req.body || {};
  if (!appId || !subject || !body) {
    return res.status(400).json({ error: 'appId, subject, body가 필요합니다.' });
  }

  // 호출자 인증 + 지원자 소유권 확인 (RLS가 본인 회사 공고 지원자만 노출)
  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return res.status(401).json({ error: '세션이 만료되었습니다.' });

  const { data: app } = await asUser
    .from('job_applications')
    .select('id, applicant_email, user_id, job_id, jobs(created_by)')
    .eq('id', appId)
    .maybeSingle();
  if (!app) return res.status(403).json({ error: '해당 지원자에 대한 권한이 없습니다.' });

  // 메일 발송은 공고 오너만 가능 (면접관 차단)
  const jobOwnerId = app.jobs?.created_by;
  if (jobOwnerId && jobOwnerId !== user.id) {
    return res.status(403).json({ error: '메일 발송은 공고 오너만 가능합니다.' });
  }

  // 수신자는 서버에서 결정 (클라이언트가 임의 주소로 못 보내게)
  let toEmail = app.applicant_email;
  if (!toEmail && app.user_id) {
    const { data: prof } = await asUser
      .from('user_profiles').select('email').eq('id', app.user_id).maybeSingle();
    toEmail = prof?.email || null;
  }
  if (!toEmail) return res.status(400).json({ error: '후보 이메일이 없어 발송할 수 없습니다.' });

  // 발송
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error: sendErr } = await resend.emails.send({
    from: RESEND_FROM,
    to: toEmail,
    subject,
    text: body,
  });

  // 발송 이력 기록 (service role — RLS 우회)
  if (SERVICE_KEY) {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    await admin.from('recruiter_mail_log').insert({
      application_id: appId,
      to_email: toEmail,
      subject,
      body,
      template_key: templateKey || null,
      sent_by: user.id,
      status: sendErr ? 'failed' : 'sent',
    });
  }

  if (sendErr) {
    return res.status(502).json({ error: '메일 발송 실패: ' + (sendErr.message || '알 수 없는 오류') });
  }
  return res.status(200).json({ success: true, to: toEmail });
}
