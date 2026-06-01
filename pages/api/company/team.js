import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// GET: 본인 회사의 채용팀 멤버 + 보류 초대 반환
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!SERVICE_KEY) return res.status(503).json({ error: '서버 설정 누락' });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });

  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return res.status(401).json({ error: '세션이 만료되었습니다.' });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: rec } = await admin
    .from('recruiter_users')
    .select('company_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!rec?.company_id) return res.status(403).json({ error: '회사 정보가 없습니다.' });

  const [{ data: members }, { data: invites }] = await Promise.all([
    admin.from('recruiter_users')
      .select('user_id, email, full_name, role, created_at')
      .eq('company_id', rec.company_id)
      .order('created_at', { ascending: true }),
    admin.from('recruiter_invites')
      .select('id, email, role, job_id, status, created_at')
      .eq('company_id', rec.company_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
  ]);

  return res.status(200).json({
    companyId: rec.company_id,
    currentUserId: user.id,
    members: members || [],
    invites: invites || [],
  });
}
