import { createClient } from '@supabase/supabase-js';
import { isJobAdmin } from '../../../lib/job-team-role';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SERVICE_KEY) return res.status(503).json({ error: '서버 설정 누락', code: 'serverConfig' });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다.', code: 'authRequired' });

  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return res.status(401).json({ error: '세션이 만료되었습니다.', code: 'sessionExpired' });

  const { jobId, userId, inviteId } = req.body || {};
  if (!jobId) return res.status(400).json({ error: 'jobId 필요', code: 'badRequest' });
  if (!userId && !inviteId) return res.status(400).json({ error: 'userId 또는 inviteId 필요', code: 'badRequest' });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: rec } = await admin
    .from('recruiter_users').select('company_id').eq('user_id', user.id).maybeSingle();
  if (!rec?.company_id) return res.status(403).json({ error: '회사 정보가 없습니다.', code: 'forbidden' });

  const { data: job } = await admin
    .from('jobs').select('id, company_id, created_by').eq('id', jobId).maybeSingle();
  if (!job || job.company_id !== rec.company_id) return res.status(403).json({ error: '해당 공고 권한 없음', code: 'forbidden' });

  // 공고 관리자(admin)만 팀원을 내보낼 수 있다. 면접관은 remove 불가.
  const canAdmin = await isJobAdmin(admin, user.id, jobId);
  if (!canAdmin) {
    return res.status(403).json({ error: '공고 관리자만 팀원을 내보낼 수 있어요.', code: 'forbidden' });
  }
  // 본인을 내보내지 못함
  if (userId && userId === user.id) {
    return res.status(400).json({ error: '본인은 내보낼 수 없어요.', code: 'badRequest' });
  }
  // 공고 작성자(created_by)는 내보낼 수 없음 — 공고 생성자는 항상 관리자로 유지.
  if (userId && job.created_by && userId === job.created_by) {
    return res.status(400).json({ error: '공고 작성자는 내보낼 수 없어요.', code: 'badRequest' });
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

  return res.status(400).json({ error: '처리할 대상이 없어요.', code: 'badRequest' });
}
