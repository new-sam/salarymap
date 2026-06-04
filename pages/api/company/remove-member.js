import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

  const { jobId, userId, inviteId } = req.body || {};
  if (!jobId) return res.status(400).json({ error: 'jobId 필요' });
  if (!userId && !inviteId) return res.status(400).json({ error: 'userId 또는 inviteId 필요' });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: rec } = await admin
    .from('recruiter_users').select('company_id').eq('user_id', user.id).maybeSingle();
  if (!rec?.company_id) return res.status(403).json({ error: '회사 정보가 없습니다.' });

  const { data: job } = await admin
    .from('jobs').select('id, company_id, created_by').eq('id', jobId).maybeSingle();
  if (!job || job.company_id !== rec.company_id) return res.status(403).json({ error: '해당 공고 권한 없음' });

  // 관리자(공고 owner)만 가능. legacy(created_by NULL)는 회사 멤버 누구나.
  if (job.created_by && job.created_by !== user.id) {
    return res.status(403).json({ error: '관리자만 팀원을 내보낼 수 있어요.' });
  }
  // 본인을 내보내지 못함
  if (userId && userId === user.id) {
    return res.status(400).json({ error: '본인은 내보낼 수 없어요.' });
  }
  // 공고 owner를 내보내지 못함
  if (userId && job.created_by && userId === job.created_by) {
    return res.status(400).json({ error: '관리자(공고 작성자)는 내보낼 수 없어요.' });
  }

  if (userId) {
    const { error: e } = await admin.from('job_team').delete().eq('job_id', jobId).eq('user_id', userId);
    if (e) return res.status(500).json({ error: '내보내기 실패: ' + e.message });
    return res.status(200).json({ success: true, removed: 'member' });
  }

  if (inviteId) {
    const { error: e } = await admin
      .from('recruiter_invites')
      .delete()
      .eq('id', inviteId)
      .eq('job_id', jobId)
      .eq('company_id', rec.company_id);
    if (e) return res.status(500).json({ error: '초대 취소 실패: ' + e.message });
    return res.status(200).json({ success: true, removed: 'invite' });
  }

  return res.status(400).json({ error: '처리할 대상이 없어요.' });
}
