import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// POST { jobId, userId? , inviteId? }
// 오너만 호출 가능. userId 면 job_team 에서 제거, inviteId 면 recruiter_invites 취소.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SERVICE_KEY) return res.status(503).json({ error: '서버 설정 누락' });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });

  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return res.status(401).json({ error: '세션 만료' });

  const { jobId, userId, inviteId } = req.body || {};
  if (!jobId) return res.status(400).json({ error: 'jobId 필요' });
  if (!userId && !inviteId) return res.status(400).json({ error: 'userId 또는 inviteId 필요' });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: rec } = await admin
    .from('recruiter_users').select('company_id').eq('user_id', user.id).maybeSingle();
  if (!rec?.company_id) return res.status(403).json({ error: '회사 정보 없음' });

  const { data: job } = await admin
    .from('jobs').select('id, created_by, company_id').eq('id', jobId).maybeSingle();
  if (!job || job.company_id !== rec.company_id) return res.status(403).json({ error: '공고 권한 없음' });
  if (job.created_by && job.created_by !== user.id) {
    return res.status(403).json({ error: '오너만 팀원을 관리할 수 있습니다.' });
  }

  if (userId) {
    if (job.created_by && userId === job.created_by) {
      return res.status(400).json({ error: '오너는 삭제할 수 없습니다.' });
    }
    const { error } = await admin
      .from('job_team').delete()
      .eq('job_id', jobId).eq('user_id', userId);
    if (error) return res.status(500).json({ error: '삭제 실패: ' + error.message });
    return res.status(200).json({ success: true, removed: 'member' });
  }

  // inviteId 경로
  const { error } = await admin
    .from('recruiter_invites').delete()
    .eq('id', inviteId).eq('company_id', rec.company_id).eq('job_id', jobId);
  if (error) return res.status(500).json({ error: '삭제 실패: ' + error.message });
  return res.status(200).json({ success: true, removed: 'invite' });
}
