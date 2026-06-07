import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Reverse a rejection: clear rejected_at/reason fields and write an audit
 * row into application_evaluations with stage='unreject' so the action is
 * preserved in the activity timeline.
 *
 * Body: { appId }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(503).json({ error: '서버 설정 오류' });
    }
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });

    const { appId } = req.body || {};
    if (!appId) return res.status(400).json({ error: 'appId가 필요합니다.' });

    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: userErr } = await asUser.auth.getUser();
    if (userErr || !user) return res.status(401).json({ error: '세션이 만료되었습니다.' });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: app, error: appErr } = await admin
      .from('job_applications')
      .select('id, job_id, rejected_at, rejected_at_stage, status, jobs(company_id, created_by)')
      .eq('id', appId)
      .maybeSingle();
    if (appErr || !app) return res.status(404).json({ error: '지원자를 찾을 수 없습니다.' });

    const isJobOwner = app.jobs?.created_by === user.id;
    let allowed = isJobOwner;
    if (!allowed) {
      const { data: team } = await admin
        .from('job_team').select('user_id').eq('job_id', app.job_id).eq('user_id', user.id).maybeSingle();
      if (team) allowed = true;
    }
    if (!allowed) {
      const { data: rec } = await admin
        .from('recruiter_users').select('company_id').eq('user_id', user.id).maybeSingle();
      if (rec && rec.company_id === app.jobs?.company_id) allowed = true;
    }
    if (!allowed) return res.status(403).json({ error: '권한이 없습니다.' });
    if (!app.rejected_at) return res.status(400).json({ error: '이미 진행 중인 후보입니다.' });

    const nowIso = new Date().toISOString();
    const previousStage = app.rejected_at_stage || app.status;

    const { error: updErr } = await admin
      .from('job_applications')
      .update({
        rejected_at: null,
        rejected_at_stage: null,
        rejection_reason: null,
        rejection_note: null,
        updated_at: nowIso,
      })
      .eq('id', appId);
    if (updErr) return res.status(500).json({ error: '결정 취소 실패: ' + updErr.message });

    // Audit row — reviewer_name for friendly display in timeline
    const { data: rec } = await admin
      .from('recruiter_users').select('full_name, email').eq('user_id', user.id).maybeSingle();
    const authorName = rec?.full_name || (rec?.email || '').split('@')[0] || '공고 관리자';

    await admin.from('application_evaluations').insert({
      application_id: appId,
      job_id: app.job_id,
      stage: 'unreject',
      reviewer_user_id: user.id,
      reviewer_name: authorName,
      reviewer_role: isJobOwner ? 'owner' : 'interviewer',
      // comment column is NOT NULL — always provide a summary string.
      comment: previousStage ? `불합격 결정 취소 (이전 단계: ${previousStage})` : '불합격 결정 취소',
      score: null,
    });

    return res.status(200).json({ ok: true, restoredStage: previousStage });
  } catch (e) {
    console.error('[unreject] uncaught', e);
    return res.status(500).json({ error: '오류: ' + (e?.message || 'unknown') });
  }
}
