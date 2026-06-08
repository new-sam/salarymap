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
