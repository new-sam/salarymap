import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST { email, role, jobId }
// - 이메일이 우리 회사 recruiter_users 에 이미 있으면 → job_team 에 즉시 추가
// - 외부 이메일이면 → recruiter_invites pending 저장
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

  const { email, role, jobId } = req.body || {};
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(cleanEmail)) return res.status(400).json({ error: '올바른 이메일을 입력해 주세요.' });
  if (!jobId) return res.status(400).json({ error: 'jobId 필요' });
  const cleanRole = role === 'admin' ? 'admin' : 'member';

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // 본인 회사 확인
  const { data: rec } = await admin
    .from('recruiter_users').select('company_id').eq('user_id', user.id).maybeSingle();
  if (!rec?.company_id) return res.status(403).json({ error: '회사 정보가 없습니다.' });

  // 공고가 본인 회사 소유인지 + 오너인지 확인
  const { data: job } = await admin
    .from('jobs').select('id, created_by, company_id').eq('id', jobId).maybeSingle();
  if (!job || job.company_id !== rec.company_id) return res.status(403).json({ error: '해당 공고 권한 없음' });
  if (job.created_by && job.created_by !== user.id) {
    return res.status(403).json({ error: '오너만 팀원을 초대할 수 있습니다.' });
  }

  // 우리 회사 recruiter_users 에 이미 있는 이메일인지
  const { data: existing } = await admin
    .from('recruiter_users')
    .select('user_id, email')
    .eq('company_id', rec.company_id)
    .ilike('email', cleanEmail)
    .maybeSingle();

  if (existing?.user_id) {
    // 이미 회사 멤버 → job_team 에 바로 추가 (중복은 무시)
    const { error: e } = await admin
      .from('job_team')
      .upsert({
        job_id: jobId,
        user_id: existing.user_id,
        role: 'interviewer',
        added_by: user.id,
      }, { onConflict: 'job_id,user_id' });
    if (e) return res.status(500).json({ error: '추가 실패: ' + e.message });
    return res.status(200).json({ success: true, addedDirectly: true });
  }

  // 외부 이메일 → recruiter_invites pending
  const { error: insErr } = await admin
    .from('recruiter_invites')
    .insert({
      company_id: rec.company_id,
      email: cleanEmail,
      role: cleanRole,
      job_id: jobId,
      invited_by: user.id,
      status: 'pending',
    });
  if (insErr) {
    // 동일 (job_id, email) 중복일 수 있음 — 그대로 success 취급
    if (!String(insErr.message || '').match(/duplicate|unique/i)) {
      return res.status(500).json({ error: '초대 저장 실패: ' + insErr.message });
    }
  }
  return res.status(200).json({ success: true, addedDirectly: false });
}
