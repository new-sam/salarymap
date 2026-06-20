import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 후보 열람 시 신규(pending) 지원자를 '열람(viewed)'으로. 서비스롤로 RLS 우회.
// Auth: 해당 공고의 회사 멤버(owner / job_team / recruiter_users.company_id)만.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(503).json({ error: '서버 설정 오류' });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });
  const { appId } = req.body || {};
  if (!appId) return res.status(400).json({ error: 'appId가 필요합니다.' });

  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: ud } = await asUser.auth.getUser();
  const user = ud?.user;
  if (!user) return res.status(401).json({ error: '세션이 만료되었습니다.' });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: app } = await admin
    .from('job_applications')
    .select('id, status, rejected_at, job_id, jobs(company_id, created_by)')
    .eq('id', appId).maybeSingle();
  if (!app) return res.status(404).json({ error: '지원자를 찾을 수 없습니다.' });

  let allowed = app.jobs?.created_by === user.id;
  if (!allowed) {
    const { data: team } = await admin.from('job_team').select('user_id').eq('job_id', app.job_id).eq('user_id', user.id).maybeSingle();
    if (team) allowed = true;
  }
  if (!allowed) {
    const { data: rec } = await admin.from('recruiter_users').select('company_id').eq('user_id', user.id).maybeSingle();
    if (rec && rec.company_id === app.jobs?.company_id) allowed = true;
  }
  if (!allowed) return res.status(403).json({ error: '권한이 없습니다.' });

  // pending이고 반려 안 된 경우에만 viewed로
  if (app.status === 'pending' && !app.rejected_at) {
    await admin.from('job_applications').update({ status: 'viewed', updated_at: new Date().toISOString() }).eq('id', appId);
    return res.status(200).json({ ok: true, changed: true, status: 'viewed' });
  }
  return res.status(200).json({ ok: true, changed: false, status: app.status });
}
