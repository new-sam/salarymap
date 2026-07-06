import { supabase } from './supabaseClient';

/**
 * Returns the Set of job IDs in `companyId` that `userId` may access:
 * jobs they own (`jobs.created_by = userId`) OR jobs they have been invited
 * to via `job_team`. Anything else stays hidden — sharing a company tenant
 * (예: 같은 likelion.net workspace) does NOT grant blanket visibility.
 *
 * Returns an empty Set when the user has no jobs of their own and no
 * invitations — callers should render the empty state in that case.
 */
export async function loadAccessibleJobIds(userId, companyId) {
  if (!userId || !companyId) return new Set();
  const [ownedRes, teamRes] = await Promise.all([
    supabase.from('jobs').select('id').eq('company_id', companyId).eq('created_by', userId),
    supabase
      .from('job_team')
      .select('job_id, jobs!inner(company_id)')
      .eq('user_id', userId)
      .eq('jobs.company_id', companyId),
  ]);
  const ids = new Set();
  (ownedRes.data || []).forEach(r => ids.add(r.id));
  (teamRes.data || []).forEach(r => ids.add(r.job_id));
  return ids;
}

/**
 * Returns a Map<jobId, 'admin' | 'interviewer'> for every accessible job.
 *
 * Rules:
 * - jobs.created_by === userId → 'admin' (creator is always admin — defense
 *   in depth in case the job_team backfill somehow missed the row).
 * - job_team.role === 'admin' → 'admin'
 * - job_team.role === 'interviewer' (or default) → 'interviewer'
 * - admin wins over interviewer if both signals exist for the same job.
 */
export async function loadJobRoles(userId, companyId) {
  if (!userId || !companyId) return new Map();
  const [ownedRes, teamRes] = await Promise.all([
    supabase.from('jobs').select('id').eq('company_id', companyId).eq('created_by', userId),
    supabase
      .from('job_team')
      .select('job_id, role, jobs!inner(company_id)')
      .eq('user_id', userId)
      .eq('jobs.company_id', companyId),
  ]);
  const roles = new Map();
  (teamRes.data || []).forEach(r => {
    roles.set(r.job_id, r.role === 'admin' ? 'admin' : 'interviewer');
  });
  (ownedRes.data || []).forEach(r => {
    roles.set(r.id, 'admin');
  });
  return roles;
}
