import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 본인 이메일 + 현재 소속 회사 기준으로 pending 초대 -> job_team 자동 합류
// /auth/callback 에서 회사 가입 직후 호출
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SERVICE_KEY) return res.status(503).json({ error: '서버 설정 누락', code: 'serverConfig' });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: '인증 필요', code: 'authRequired' });

  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user?.email) return res.status(401).json({ error: '세션 만료', code: 'sessionExpired' });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // 사용자의 소속 회사들
  const { data: memberships } = await admin
    .from('recruiter_users')
    .select('company_id')
    .eq('user_id', user.id);
  const companyIds = (memberships || []).map(m => m.company_id);
  if (!companyIds.length) return res.status(200).json({ accepted: 0 });

  // 본인 이메일 대상 pending 초대 (소속 회사 + job_id 있는 것만)
  const { data: invites } = await admin
    .from('recruiter_invites')
    .select('id, job_id, invited_by, company_id, role')
    .ilike('email', user.email)
    .eq('status', 'pending')
    .in('company_id', companyIds)
    .not('job_id', 'is', null);

  if (!invites || invites.length === 0) return res.status(200).json({ accepted: 0 });

  // job_team upsert (이미 있으면 skip). recruiter_invites.role 은 legacy 로
  // 'admin' | 'member' 를 저장하므로 job_team.role 로 매핑한다.
  const teamRows = invites.map(iv => ({
    job_id: iv.job_id,
    user_id: user.id,
    role: iv.role === 'admin' ? 'admin' : 'interviewer',
    added_by: iv.invited_by,
  }));
  const { error: teamErr } = await admin
    .from('job_team')
    .upsert(teamRows, { onConflict: 'job_id,user_id' });
  if (teamErr) return res.status(500).json({ error: 'job_team 합류 실패: ' + teamErr.message });

  // 초대 accepted 처리
  await admin
    .from('recruiter_invites')
    .update({ status: 'accepted' })
    .in('id', invites.map(iv => iv.id));

  return res.status(200).json({ accepted: invites.length });
}
