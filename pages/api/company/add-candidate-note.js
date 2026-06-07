import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Append a new note to a candidate.
 * Notes are stored in application_evaluations with stage='note' so they
 * appear in evals fetches but are kept separate in the UI.
 *
 * Body: { appId, content }
 * Response: { ok, note: { id, comment, created_at, reviewer_name, reviewer_role } }
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

    const { appId, content } = req.body || {};
    if (!appId) return res.status(400).json({ error: 'appId가 필요합니다.' });
    if (typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: '메모 내용을 입력해주세요.' });
    }

    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: userErr } = await asUser.auth.getUser();
    if (userErr || !user) return res.status(401).json({ error: '세션이 만료되었습니다.' });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: app, error: appErr } = await admin
      .from('job_applications')
      .select('id, job_id, jobs(company_id, created_by)')
      .eq('id', appId)
      .maybeSingle();
    if (appErr || !app) {
      return res.status(404).json({ error: '지원자를 찾을 수 없습니다.' });
    }

    const isJobOwner = app.jobs?.created_by === user.id;
    let allowed = isJobOwner;
    if (!allowed) {
      const { data: team } = await admin
        .from('job_team')
        .select('user_id')
        .eq('job_id', app.job_id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (team) allowed = true;
    }
    if (!allowed) {
      const { data: rec } = await admin
        .from('recruiter_users')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (rec && rec.company_id === app.jobs?.company_id) allowed = true;
    }
    if (!allowed) {
      return res.status(403).json({ error: '메모 작성 권한이 없습니다.' });
    }

    // Look up display name + role
    const { data: rec } = await admin
      .from('recruiter_users')
      .select('full_name, email')
      .eq('user_id', user.id)
      .maybeSingle();
    const authorName = rec?.full_name || (rec?.email || '').split('@')[0] || '공고 관리자';
    const role = isJobOwner ? 'owner' : 'interviewer';

    const { data: inserted, error: insErr } = await admin
      .from('application_evaluations')
      .insert({
        application_id: appId,
        job_id: app.job_id,
        stage: 'note',
        reviewer_user_id: user.id,
        reviewer_name: authorName,
        reviewer_role: role,
        comment: content,
        score: null,
      })
      .select('id, comment, score, stage, reviewer_user_id, reviewer_name, reviewer_role, created_at')
      .single();

    if (insErr) {
      console.error('[add-note] insert err', insErr);
      return res.status(500).json({ error: '메모 저장 실패: ' + insErr.message });
    }

    return res.status(200).json({ ok: true, note: inserted });
  } catch (e) {
    console.error('[add-note] uncaught', e);
    return res.status(500).json({ error: '메모 저장 중 오류: ' + (e?.message || 'unknown') });
  }
}
