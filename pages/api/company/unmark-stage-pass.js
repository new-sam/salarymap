import { createClient } from '@supabase/supabase-js';
import { isJobAdmin } from '../../../lib/job-team-role';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Delete a stage-pass audit row. Owner of the job (or its team) only. */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(503).json({ error: '서버 설정 오류', code: 'serverConfig' });
    }
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: '로그인이 필요합니다.', code: 'authRequired' });

    const { rowId } = req.body || {};
    if (!rowId) return res.status(400).json({ error: 'rowId가 필요합니다.', code: 'badRequest' });

    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return res.status(401).json({ error: '세션이 만료되었습니다.', code: 'sessionExpired' });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: row } = await admin
      .from('application_evaluations')
      .select('id, stage, application_id, job_applications(job_id)')
      .eq('id', rowId)
      .maybeSingle();
    if (!row || !row.stage?.endsWith('_pass')) {
      return res.status(404).json({ error: '합격 결정 row를 찾을 수 없습니다.', code: 'badRequest' });
    }
    const jobId = row.job_applications?.job_id;
    const canAdmin = jobId && await isJobAdmin(admin, user.id, jobId);
    if (!canAdmin) return res.status(403).json({ error: '공고 관리자만 취소할 수 있습니다.', code: 'forbidden' });

    const { error } = await admin.from('application_evaluations').delete().eq('id', rowId);
    if (error) return res.status(500).json({ error: '삭제 실패: ' + error.message });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[unmark-stage-pass] uncaught', e);
    return res.status(500).json({ error: '오류: ' + (e?.message || 'unknown') });
  }
}
