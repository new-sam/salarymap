// Backfill: re-classify job_applications that originated from the salary product but
// were recorded as 'direct'. The button-marker signal (application_source) missed any
// user who browsed from salary-fyi.com to /jobs and applied without the CTA. The
// original landing referrer recovers them. Same rule as pages/api/job-applications.js.
//
// Usage:
//   node scripts/backfill-application-source.js          # DRY RUN (no writes)
//   node scripts/backfill-application-source.js --apply   # apply the UPDATE
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://twpxsbnkypocjfnerfmd.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const APPLY = process.argv.includes('--apply');
const SALARY_REFERRER = '%salary-fyi.com%';

async function main() {
  // Candidates: salary-domain referrer, not already tagged 'salary'.
  const { data: candidates, error } = await supabase
    .from('job_applications')
    .select('id, created_at, applicant_email, application_source, referrer')
    .ilike('referrer', SALARY_REFERRER)
    .neq('application_source', 'salary')
    .order('created_at', { ascending: false });

  if (error) { console.error('Select error:', error.message); process.exit(1); }

  console.log(`\nCandidates (referrer ~ salary-fyi.com, source != salary): ${candidates.length}`);
  const byEmail = {};
  for (const r of candidates) byEmail[r.applicant_email] = (byEmail[r.applicant_email] || 0) + 1;
  console.log('By applicant:', byEmail);

  if (!APPLY) {
    console.log('\n[DRY RUN] No writes. Re-run with --apply to update these rows to application_source=\'salary\'.');
    return;
  }

  const { data: updated, error: uErr } = await supabase
    .from('job_applications')
    .update({ application_source: 'salary' })
    .ilike('referrer', SALARY_REFERRER)
    .neq('application_source', 'salary')
    .select('id');

  if (uErr) { console.error('Update error:', uErr.message); process.exit(1); }
  console.log(`\n[APPLIED] Updated ${updated.length} rows to application_source='salary'.`);

  // Verify new distribution.
  const { data: all } = await supabase.from('job_applications').select('application_source');
  const dist = {};
  for (const r of all) { const s = r.application_source || 'NULL'; dist[s] = (dist[s] || 0) + 1; }
  console.log('New application_source distribution:', dist);
}

main();
