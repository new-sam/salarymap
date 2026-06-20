import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 회사 공고 활성/비활성 토글 + 삭제. 서비스롤로 RLS 우회.
// Auth: 공고 회사 멤버(owner / job_team / recruiter_users.company_id)만.
export default async function handler(req, res) {
  if (req.method !== 'PUT' && req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(503).json({ error: '서버 설정 오류' });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });
  const { jobId, action } = req.body || {};
  if (!jobId) return res.status(400).json({ error: 'jobId가 필요합니다.' });

  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: ud } = await asUser.auth.getUser();
  const user = ud?.user;
  if (!user) return res.status(401).json({ error: '세션이 만료되었습니다.' });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: job } = await admin.from('jobs').select('id, company_id, created_by').eq('id', jobId).maybeSingle();
  if (!job) return res.status(404).json({ error: '공고를 찾을 수 없습니다.' });

  let allowed = job.created_by === user.id;
  if (!allowed) {
    const { data: team } = await admin.from('job_team').select('user_id').eq('job_id', jobId).eq('user_id', user.id).maybeSingle();
    if (team) allowed = true;
  }
  if (!allowed) {
    const { data: rec } = await admin.from('recruiter_users').select('company_id').eq('user_id', user.id).maybeSingle();
    if (rec && rec.company_id === job.company_id) allowed = true;
  }
  if (!allowed) return res.status(403).json({ error: '권한이 없습니다.' });

  if (req.method === 'DELETE') {
    const { error } = await admin.from('jobs').delete().eq('id', jobId);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, deleted: true });
  }

  // PUT: 활성/비활성 토글
  const activate = action === 'activate';
  const { error } = await admin.from('jobs')
    .update({ status: activate ? 'live' : 'paused', is_active: activate })
    .eq('id', jobId);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true, is_active: activate });
}
