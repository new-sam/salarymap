// 서버 사이드 role 게이팅 헬퍼.
//
// 정책:
// - 공고 관리자(admin)  = 그 공고의 job_team.role='admin' 인 사람
// - 면접관(interviewer) = 그 공고의 job_team.role='interviewer' 인 사람
// - 기존 백필로 모든 공고의 created_by 는 admin 으로 등록돼 있지만, 만약 어떤
//   이유로 그 row 가 빠졌더라도 created_by 는 항상 admin 으로 취급한다
//   (defense in depth — 배포 중 백필 누락된 공고에서 오너가 락아웃되지 않게).
//
// 사용: `import { getJobRole } from '../../../lib/job-team-role'`

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} adminClient  service-role client
 * @param {string} userId
 * @param {string} jobId
 * @returns {Promise<'admin' | 'interviewer' | null>}
 */
export async function getJobRole(adminClient, userId, jobId) {
  if (!userId || !jobId) return null;

  const [{ data: job }, { data: team }] = await Promise.all([
    adminClient.from('jobs').select('created_by').eq('id', jobId).maybeSingle(),
    adminClient.from('job_team').select('role').eq('job_id', jobId).eq('user_id', userId).maybeSingle(),
  ]);

  if (job?.created_by === userId) return 'admin';
  if (team?.role === 'admin') return 'admin';
  if (team?.role === 'interviewer') return 'interviewer';
  return null;
}

/**
 * true 이면 그 공고에서 admin 권한을 가진다 (오너이거나 job_team.role='admin').
 * @param {import('@supabase/supabase-js').SupabaseClient} adminClient
 */
export async function isJobAdmin(adminClient, userId, jobId) {
  const role = await getJobRole(adminClient, userId, jobId);
  return role === 'admin';
}
