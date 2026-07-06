import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// GET ?jobId=X — 해당 공고의 채용팀(owner + interviewers) + 보류 초대
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!SERVICE_KEY) return res.status(503).json({ error: '서버 설정 누락' });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });

  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return res.status(401).json({ error: '세션이 만료되었습니다.' });

  const jobId = req.query.jobId;
  if (!jobId) return res.status(400).json({ error: 'jobId 필요' });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // 본인 회사 + 공고 소유 확인
  const { data: rec } = await admin
    .from('recruiter_users').select('company_id').eq('user_id', user.id).maybeSingle();
  if (!rec?.company_id) return res.status(403).json({ error: '회사 정보가 없습니다.' });

  const { data: job } = await admin
    .from('jobs').select('id, created_by, company_id').eq('id', jobId).maybeSingle();
  if (!job || job.company_id !== rec.company_id) {
    return res.status(403).json({ error: '해당 공고 권한 없음' });
  }

  // job_team 멤버 (user_id 목록)
  const { data: teamRows } = await admin
    .from('job_team')
    .select('user_id, role, created_at')
    .eq('job_id', jobId);

  // user_id → recruiter_users (회사 내 프로필) 매핑
  const userIds = (teamRows || []).map(r => r.user_id);
  let profilesByUid = {};
  if (userIds.length) {
    const { data: profs } = await admin
      .from('recruiter_users')
      .select('user_id, email, full_name')
      .in('user_id', userIds);
    (profs || []).forEach(p => { profilesByUid[p.user_id] = p; });
  }

  const members = (teamRows || []).map(r => ({
    user_id: r.user_id,
    role: r.role,
    email: profilesByUid[r.user_id]?.email || null,
    full_name: profilesByUid[r.user_id]?.full_name || null,
    created_at: r.created_at,
  }));

  // 공고 owner (jobs.created_by) 는 항상 admin 으로 취급. job_team 에 이미
  // 있으면 role 을 admin 으로 승격, 없으면 합성해서 추가한다.
  if (job.created_by) {
    const existing = members.find(m => m.user_id === job.created_by);
    if (existing) {
      existing.role = 'admin';
    } else {
      const { data: ownerProf } = await admin
        .from('recruiter_users')
        .select('user_id, email, full_name')
        .eq('user_id', job.created_by)
        .maybeSingle();
      members.push({
        user_id: job.created_by,
        role: 'admin',
        email: ownerProf?.email || null,
        full_name: ownerProf?.full_name || null,
        created_at: null,
      });
    }
  }

  // 본인이 채용팀에 안 들어있으면 면접관으로 자동 합성 (회사 멤버이므로 자동 권한)
  const meInMembers = members.some(m => m.user_id === user.id);
  if (!meInMembers) {
    const { data: meProf } = await admin
      .from('recruiter_users')
      .select('user_id, email, full_name')
      .eq('user_id', user.id)
      .maybeSingle();
    if (meProf) {
      members.push({
        user_id: user.id,
        role: 'interviewer',
        email: meProf.email,
        full_name: meProf.full_name,
        created_at: null,
      });
    }
  }

  // 정렬: admin 먼저 (공고 관리자), 그 다음 본인(나), 그 다음 나머지 면접관
  members.sort((a, b) => {
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    if (a.role !== 'admin' && b.role === 'admin') return 1;
    if (a.user_id === user.id && b.user_id !== user.id) return -1;
    if (a.user_id !== user.id && b.user_id === user.id) return 1;
    return 0;
  });

  // 보류 초대 (이 공고 한정)
  const { data: invites } = await admin
    .from('recruiter_invites')
    .select('id, email, role, status, created_at')
    .eq('company_id', rec.company_id)
    .eq('job_id', jobId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  // 현재 유저가 이 공고에서 admin 인지 — 초대/삭제 버튼 표시 여부에 쓴다.
  const iAmAdmin = members.some(m => m.user_id === user.id && m.role === 'admin');

  return res.status(200).json({
    jobId,
    companyId: rec.company_id,
    ownerUserId: job.created_by || null,
    currentUserId: user.id,
    currentUserIsAdmin: iAmAdmin,
    members,
    invites: invites || [],
  });
}
