// One-off role swap for "정부 사업 운영 매니저" job.
// Owner: younghun → kee
// younghun added to job_team as interviewer
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map(l => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY'); process.exit(1); }

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const log = (...a) => console.log('•', ...a);

// 1. find users
const { data: users, error: uErr } = await admin
  .from('recruiter_users')
  .select('user_id, email, full_name')
  .in('email', ['kee@likelion.net', 'younghun@likelion.net']);
if (uErr) throw uErr;
const kee = users.find(u => u.email === 'kee@likelion.net');
const younghun = users.find(u => u.email === 'younghun@likelion.net');
if (!kee || !younghun) { console.error('User lookup failed', users); process.exit(1); }
log('kee', kee.user_id);
log('younghun', younghun.user_id);

// 2. find job
const JOB_ID = 'a3223214-22bf-41f1-b2df-7ca869bfdc52'; // 정부 사업 기획/운영 매니저 (인턴)
const { data: job, error: jErr } = await admin
  .from('jobs')
  .select('id, title, created_by')
  .eq('id', JOB_ID)
  .single();
if (jErr || !job) { console.error('Job lookup failed', jErr); process.exit(1); }
log('job', job.id, '|', job.title, '| owner:', job.created_by);

// 3. set owner to kee
const { error: upErr } = await admin
  .from('jobs')
  .update({ created_by: kee.user_id })
  .eq('id', job.id);
if (upErr) throw upErr;
log('owner →', kee.user_id);

// 4. younghun as interviewer in job_team
//    Try update first; if no row, insert.
const { data: existing } = await admin
  .from('job_team')
  .select('user_id, role')
  .eq('job_id', job.id)
  .eq('user_id', younghun.user_id)
  .maybeSingle();
if (existing) {
  const { error } = await admin
    .from('job_team')
    .update({ role: 'interviewer' })
    .eq('job_id', job.id)
    .eq('user_id', younghun.user_id);
  if (error) throw error;
  log('younghun job_team row updated → interviewer');
} else {
  const { error } = await admin
    .from('job_team')
    .insert({ job_id: job.id, user_id: younghun.user_id, role: 'interviewer' });
  if (error) throw error;
  log('younghun inserted into job_team as interviewer');
}

// 5. remove any kee row from job_team (owner is derived from jobs.created_by)
const { data: keeRow } = await admin
  .from('job_team')
  .select('user_id')
  .eq('job_id', job.id)
  .eq('user_id', kee.user_id)
  .maybeSingle();
if (keeRow) {
  const { error } = await admin
    .from('job_team')
    .delete()
    .eq('job_id', job.id)
    .eq('user_id', kee.user_id);
  if (error) throw error;
  log('kee row removed from job_team');
} else {
  log('kee not in job_team — nothing to remove');
}

// 6. verify
const { data: ver } = await admin
  .from('jobs')
  .select('id, title, created_by')
  .eq('id', job.id)
  .single();
const { data: team } = await admin
  .from('job_team')
  .select('user_id, role')
  .eq('job_id', job.id);
console.log('\n✓ Result');
console.log('  job.created_by =', ver.created_by, '(should be kee:', kee.user_id, ')');
console.log('  job_team:');
for (const m of (team || [])) {
  const name = users.find(u => u.user_id === m.user_id)?.email || m.user_id;
  console.log('    -', name, '|', m.role);
}
