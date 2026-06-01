import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NOTIFY_EMAIL = process.env.CONTACT_NOTIFY_EMAIL || 'ceo_office@likelion.net';
const RESEND_FROM = process.env.RESEND_FROM || 'FYI <onboarding@resend.dev>';

// 새 공고가 pending_review 로 들어왔을 때 어드민 알림 (Slack + Email, 베스트에포트)
// POST { jobId } / Bearer = 작성한 회사 유저
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SERVICE_KEY) return res.status(200).json({ ok: false, reason: 'no_service_key' });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: '인증 필요' });

  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return res.status(401).json({ error: '세션 만료' });

  const { jobId } = req.body || {};
  if (!jobId) return res.status(400).json({ error: 'jobId 필요' });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: job } = await admin
    .from('jobs')
    .select('id, title, company, location, salary_min, salary_max, created_by, status, company_id')
    .eq('id', jobId).maybeSingle();
  if (!job || job.created_by !== user.id) return res.status(403).json({ error: '권한 없음' });

  const adminUrl = `https://salary-fyi.com/admin/jobs`;
  const lines = [
    `*${job.title}* (${job.company})`,
    `위치: ${job.location || '-'} · ₫${Math.round((job.salary_min||0)/1e6)}M–${Math.round((job.salary_max||0)/1e6)}M`,
    `작성자: ${user.email}`,
    `승인: ${adminUrl}`,
  ];

  // Slack (옵션)
  if (process.env.SLACK_WEBHOOK_URL) {
    try {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `:mailbox_with_mail: *새 공고 승인 대기*\n${lines.join('\n')}` }),
      });
    } catch (_) {}
  }

  // Email
  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: RESEND_FROM,
        to: NOTIFY_EMAIL,
        replyTo: user.email,
        subject: `[FYI Admin] 새 공고 승인 대기 — ${job.title} (${job.company})`,
        text: lines.join('\n'),
      });
    } catch (_) {}
  }

  return res.status(200).json({ ok: true });
}
