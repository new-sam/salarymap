// Idempotent backfill: 모든 기존 공고에 대해 jobs.created_by 를 그 공고의
// job_team admin 으로 등록한다. supabase/migrations/20260706_job_team_admin_role.sql
// 과 같은 작업을 supabase-js 로 실행한다 (원격 DB 에 직접 연결 없이 실행 가능).
//
// 실행: node scripts/backfill_job_team_admin.mjs

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

const { data: jobs, error: jErr } = await admin
  .from('jobs')
  .select('id, created_by')
  .not('created_by', 'is', null);
if (jErr) { console.error('jobs read err', jErr); process.exit(1); }

console.log(`• found ${jobs.length} jobs with a creator`);

const rows = jobs.map(j => ({
  job_id: j.id,
  user_id: j.created_by,
  role: 'admin',
  added_by: j.created_by,
}));

if (!rows.length) { console.log('nothing to backfill'); process.exit(0); }

const { error: upErr } = await admin
  .from('job_team')
  .upsert(rows, { onConflict: 'job_id,user_id' });
if (upErr) { console.error('upsert err', upErr); process.exit(1); }

console.log(`• upserted ${rows.length} admin rows`);
process.exit(0);
