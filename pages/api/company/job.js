import { createClient } from '@supabase/supabase-js';
import { isJobAdmin } from '../../../lib/job-team-role';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 회사 공고 활성/비활성 토글 + 삭제. 서비스롤로 RLS 우회.
// Auth: 그 공고의 공고 관리자(admin) 만 가능. 면접관은 편집·비활성화 불가.
export default async function handler(req, res) {
  if (req.method !== 'PUT' && req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(503).json({ error: '서버 설정 오류', code: 'serverConfig' });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다.', code: 'authRequired' });
  const { jobId, action } = req.body || {};
  if (!jobId) return res.status(400).json({ error: 'jobId가 필요합니다.', code: 'badRequest' });

  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: ud } = await asUser.auth.getUser();
  const user = ud?.user;
  if (!user) return res.status(401).json({ error: '세션이 만료되었습니다.', code: 'sessionExpired' });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: job } = await admin.from('jobs').select('id, company_id, created_by, status').eq('id', jobId).maybeSingle();
  if (!job) return res.status(404).json({ error: '공고를 찾을 수 없습니다.', code: 'jobNotFound' });

  const canAdmin = await isJobAdmin(admin, user.id, jobId);
  if (!canAdmin) return res.status(403).json({ error: '공고 관리자만 가능합니다.', code: 'forbidden' });

  if (req.method === 'DELETE') {
    const { error } = await admin.from('jobs').delete().eq('id', jobId);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, deleted: true });
  }

  // PUT: 활성/비활성 토글
  const activate = action === 'activate';
  // 게시(activate)는 이전에 승인되어 live였던(=paused) 공고 재개만 허용.
  // 승인 대기(pending_review)/초안(draft)/반려·마감 공고를 스스로 게시하는 건 차단 → 관리자 승인 필요.
  if (activate && job.status !== 'paused') {
    return res.status(403).json({ error: '관리자 승인 후에만 공고를 게시할 수 있습니다.', code: 'needsApproval' });
  }
  const { error } = await admin.from('jobs')
    .update({ status: activate ? 'live' : 'paused', is_active: activate })
    .eq('id', jobId);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true, is_active: activate });
}
