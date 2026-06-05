import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NOTIFY_EMAIL = process.env.CONTACT_NOTIFY_EMAIL || 'ceo_office@likelion.net';
const RESEND_FROM = process.env.RESEND_FROM || 'FYI for Companies <onboarding@resend.dev>';

// Best-effort notifications — never block the lead from being saved.
async function notify({ email, companyName, position, contactName, phone, message }) {
  const lines = [
    `회사: ${companyName || '-'}`,
    `포지션: ${position || '-'}`,
    `담당자: ${contactName || '-'}`,
    `연락처: ${phone || '-'}`,
    `이메일: ${email || '-'}`,
    `요청: ${message || '-'}`,
  ];

  // Slack — AM이 바로 대응하는 상담 전용 채널 (KPI 봇 웹훅과 분리)
  if (process.env.SLACK_CONTACT_WEBHOOK_URL) {
    try {
      await fetch(process.env.SLACK_CONTACT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `:wave: *기업 상담 요청*\n${lines.join('\n')}` }),
      });
    } catch (_) {}
  }

  // Email via Resend
  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: RESEND_FROM,
        to: NOTIFY_EMAIL,
        replyTo: email || undefined,
        subject: `[FYI 기업 상담] ${companyName || email || '신규 문의'}`,
        text: lines.join('\n'),
      });
    } catch (_) {}
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SERVICE_KEY) return res.status(503).json({ error: '서버 설정이 누락되었습니다.' });

  const { companyName, position, contactName, phone, message, website } = req.body || {};

  // honeypot — 봇이 채우는 숨김 필드. 채워져 있으면 조용히 성공 처리하고 버린다.
  if (website) return res.status(200).json({ success: true });

  if (!companyName || !position || !phone) {
    return res.status(400).json({ error: '기업·포지션·연락처를 입력해 주세요.' });
  }

  // 로그인은 선택 — 비로그인 게스트도 상담 요청을 남길 수 있다.
  let userId = null;
  let email = null;
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (token) {
    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await asUser.auth.getUser();
    if (user) { userId = user.id; email = user.email || null; }
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { error: insErr } = await admin.from('company_contact_requests').insert({
    user_id: userId,
    email,
    company_name: companyName,
    position,
    contact_name: contactName || null,
    phone,
    message: message || null,
  });
  if (insErr) {
    return res.status(500).json({ error: '접수 중 오류가 발생했습니다.' });
  }

  await notify({ email, companyName, position, contactName, phone, message });
  return res.status(200).json({ success: true });
}
