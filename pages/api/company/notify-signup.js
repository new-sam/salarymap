import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 새 기업 계정 가입 시 Slack 알림 (베스트에포트). POST { companyId } / Bearer = 가입 유저
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SERVICE_KEY) return res.status(200).json({ ok: false, reason: 'no_service_key' });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: '인증 필요' });

  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return res.status(401).json({ error: '세션 만료' });

  const { companyId } = req.body || {};
  if (!companyId) return res.status(400).json({ error: 'companyId 필요' });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: company } = await admin
    .from('recruiter_companies')
    .select('name, email_domain, created_by')
    .eq('id', companyId).maybeSingle();
  if (!company) return res.status(404).json({ error: 'company not found' });

  const slackUrl = process.env.SLACK_CONTACT_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
  if (slackUrl) {
    try {
      await fetch(slackUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `:office: *새 기업 계정 가입* — ${company.name} (${company.email_domain || '-'}) · ${user.email}` }),
      });
    } catch (_) {}
  }
  return res.status(200).json({ ok: true });
}
