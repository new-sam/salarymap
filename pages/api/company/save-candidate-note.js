import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Save a per-candidate internal note (job_applications.admin_note).
 * Auth: must be a member of the candidate's company (owner OR job_team OR recruiter_users).
 * The service role performs the actual update so RLS can be tightly scoped.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[save-note] start', { hasUrl: !!SUPABASE_URL, hasKey: !!SERVICE_KEY });
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(503).json({ error: '서버 설정 오류 (SUPABASE 환경변수)' });
    }

    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });

    const { appId, note } = req.body || {};
    console.log('[save-note] body', { appId, noteLen: typeof note === 'string' ? note.length : 'not-string' });
    if (!appId) return res.status(400).json({ error: 'appId가 필요합니다.' });
    if (typeof note !== 'string') return res.status(400).json({ error: 'note는 문자열이어야 합니다.' });

    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await asUser.auth.getUser();
    const user = userData?.user;
    console.log('[save-note] auth', { userId: user?.id, userErr: userErr?.message });
    if (userErr || !user) return res.status(401).json({ error: '세션이 만료되었습니다.' });

    // Read with service role so we don't get blocked by RLS at the verify step
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: app, error: appErr } = await admin
      .from('job_applications')
      .select('id, job_id, jobs(company_id, created_by)')
      .eq('id', appId)
      .maybeSingle();
    console.log('[save-note] app', { found: !!app, appErr: appErr?.message, companyId: app?.jobs?.company_id, owner: app?.jobs?.created_by });
    if (appErr || !app) {
      return res.status(404).json({ error: '지원자를 찾을 수 없습니다.' });
    }

    // Verify caller is part of this company / job team
    const jobCompanyId = app.jobs?.company_id;
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
      if (rec && rec.company_id === jobCompanyId) allowed = true;
    }
    console.log('[save-note] auth check', { isJobOwner, allowed });
    if (!allowed) {
      return res.status(403).json({ error: '메모 저장 권한이 없습니다.' });
    }

    // Update only the columns we know exist.
    const nowIso = new Date().toISOString();
    const { error: updErr } = await admin
      .from('job_applications')
      .update({ admin_note: note, updated_at: nowIso })
      .eq('id', appId);
    console.log('[save-note] update', { updErr: updErr?.message });
    if (updErr) {
      return res.status(500).json({ error: '메모 저장 실패: ' + updErr.message });
    }

    // Try to fetch a friendly display name for the actor
    let updatedByName = '공고 관리자';
    try {
      const { data: rec } = await admin
        .from('recruiter_users')
        .select('full_name, email')
        .eq('user_id', user.id)
        .maybeSingle();
      if (rec) {
        updatedByName = rec.full_name || (rec.email || '').split('@')[0] || '공고 관리자';
      }
    } catch {}

    return res.status(200).json({
      ok: true,
      updatedAt: nowIso,
      updatedByName,
    });
  } catch (e) {
    console.error('[save-candidate-note] uncaught', e);
    return res.status(500).json({ error: '메모 저장 중 오류: ' + (e?.message || 'unknown') });
  }
}
