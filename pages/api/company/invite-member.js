import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const cleanRole = role === 'admin' ? 'admin' : 'member';

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: rec } = await admin
    .from('recruiter_users')
    .select('company_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!rec?.company_id) return res.status(403).json({ error: '회사 정보가 없습니다.' });

  // 이미 팀원인지 확인
  const { data: existing } = await admin
    .from('recruiter_users')
    .select('id')
    .eq('company_id', rec.company_id)
    .ilike('email', cleanEmail)
    .maybeSingle();
  if (existing) return res.status(409).json({ error: '이미 팀원입니다.' });

  // 초대 upsert (이메일 중복은 update)
  const { error: insErr } = await admin
    .from('recruiter_invites')
    .upsert({
      company_id: rec.company_id,
      email: cleanEmail,
      role: cleanRole,
      job_id: jobId || null,
      invited_by: user.id,
      status: 'pending',
    }, { onConflict: 'company_id,email' });

  if (insErr) return res.status(500).json({ error: '초대 저장 실패: ' + insErr.message });
  return res.status(200).json({ success: true });
}
