import { createClient } from '@supabase/supabase-js';
import { isJobAdmin } from '../../../lib/job-team-role';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Mark the current stage as "합격 결정" — decision only, no stage move.
 * Writes an audit row into application_evaluations with stage='${currentStage}_pass'.
 *
 * Body: { appId }
 * Response: { ok, row }
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

    // Optional `stage` lets callers mark a stage other than the candidate's
    // current one — used when a drag-to-advance implicitly passes the
    // origin stage (1차 → 2차 drag means 1차 합격, not 2차 합격).
    const { appId, stage } = req.body || {};
    if (!appId) return res.status(400).json({ error: 'appId가 필요합니다.' });
    const VALID_STAGES = ['pending', 'viewed', 'reviewing'];
    if (stage && !VALID_STAGES.includes(stage)) {
      return res.status(400).json({ error: '유효하지 않은 단계입니다.' });
    }

    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: userErr } = await asUser.auth.getUser();
    if (userErr || !user) return res.status(401).json({ error: '세션이 만료되었습니다.' });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: app, error: appErr } = await admin
      .from('job_applications')
      .select('id, job_id, status, rejected_at, jobs(company_id, created_by)')
      .eq('id', appId)
      .maybeSingle();
    if (appErr || !app) return res.status(404).json({ error: '지원자를 찾을 수 없습니다.' });
    if (app.rejected_at) return res.status(400).json({ error: '불합격 처리된 후보입니다.' });

    // 합격 결정은 공고 관리자(admin)만 가능. 면접관은 평가 작성까지만.
    const canAdmin = await isJobAdmin(admin, user.id, app.job_id);
    if (!canAdmin) return res.status(403).json({ error: '합격 결정은 공고 관리자만 가능합니다.' });

    // Resolve actor name
    const { data: rec } = await admin
      .from('recruiter_users').select('full_name, email').eq('user_id', user.id).maybeSingle();
    const authorName = rec?.full_name || (rec?.email || '').split('@')[0] || '공고 관리자';

    const targetStageKey = stage || app.status;
    const stagePassKey = `${targetStageKey}_pass`;
    const STAGE_LABEL = { pending: '서류', viewed: '1차 인터뷰', reviewing: '2차 인터뷰' };
    const stageLabel = STAGE_LABEL[targetStageKey] || targetStageKey;
    const { data: row, error: insErr } = await admin
      .from('application_evaluations')
      .insert({
        application_id: appId,
        job_id: app.job_id,
        stage: stagePassKey,
        reviewer_user_id: user.id,
        reviewer_name: authorName,
        reviewer_role: 'owner',
        // comment column is NOT NULL — store a human-readable summary.
        comment: `${stageLabel} 전형 합격으로 결정`,
        score: null,
      })
      .select()
      .single();
    if (insErr) {
      console.error('[mark-stage-pass] insert err', insErr);
      return res.status(500).json({ error: '합격 처리 실패: ' + insErr.message });
    }
    return res.status(200).json({ ok: true, row });
  } catch (e) {
    console.error('[mark-stage-pass] uncaught', e);
    return res.status(500).json({ error: '오류: ' + (e?.message || 'unknown') });
  }
}
