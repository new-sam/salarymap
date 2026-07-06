// LIKELION VN 의 "Business Development Specialist" 공고에 younghun@likelion.net 을
// 공고 관리자(admin) 로 추가한다. idempotent.

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

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 1) find job — title 매칭, LIKELION VN 회사
const { data: jobs, error: jErr } = await admin
  .from('jobs')
  .select('id, title, company_id, created_by, recruiter_companies(name)')
  .ilike('title', '%Business Development Specialist%');
if (jErr) { console.error(jErr); process.exit(1); }
console.log(`• candidate jobs (${jobs?.length || 0}):`);
for (const j of jobs || []) {
  console.log(`  - ${j.id.slice(0,8)} | ${j.title} | company=${j.recruiter_companies?.name}`);
}
const target = (jobs || []).find(j => (j.recruiter_companies?.name || '').toUpperCase().includes('LIKELION'));
if (!target) { console.error('no LIKELION job match'); process.exit(1); }
console.log(`• target job: ${target.id} — ${target.title} (${target.recruiter_companies?.name})`);

// 2) find user
const { data: user, error: uErr } = await admin
  .from('recruiter_users')
  .select('user_id, email, full_name, company_id')
  .ilike('email', 'younghun@likelion.net')
  .maybeSingle();
if (uErr || !user) { console.error('user lookup failed', uErr); process.exit(1); }
console.log(`• user: ${user.email} (user_id=${user.user_id.slice(0,8)}, company=${user.company_id.slice(0,8)})`);
if (user.company_id !== target.company_id) {
  console.error(`✗ user's company (${user.company_id}) ≠ job's company (${target.company_id}) — cannot add`);
  process.exit(1);
}

// 3) upsert as admin
const { data: existing } = await admin
  .from('job_team')
  .select('role')
  .eq('job_id', target.id)
  .eq('user_id', user.user_id)
  .maybeSingle();
console.log(`• existing job_team role: ${existing?.role || '(none)'}`);

const { error: upErr } = await admin
  .from('job_team')
  .upsert(
    { job_id: target.id, user_id: user.user_id, role: 'admin', added_by: target.created_by || user.user_id },
    { onConflict: 'job_id,user_id' }
  );
if (upErr) { console.error('upsert failed:', upErr); process.exit(1); }

const { data: verify } = await admin
  .from('job_team')
  .select('role')
  .eq('job_id', target.id)
  .eq('user_id', user.user_id)
  .maybeSingle();
console.log(`✓ done. job_team role now: ${verify?.role}`);
