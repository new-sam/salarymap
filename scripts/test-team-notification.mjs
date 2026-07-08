// 지원 접수 → 채용팀 알림 메일 테스트 발송.
//
// 사용법:
//   node scripts/test-team-notification.mjs                 # 가장 최근 지원 자동 pick
//   node scripts/test-team-notification.mjs <applicationId> # 특정 지원 지정
//
// 이 스크립트는 항상 NOTIFY_TEAM_OVERRIDE_TO 를 younghun@likelion.net 로
// 강제 설정한다 (실제 채용팀에 발송되지 않음). 확인 후 프로덕션 배포.

import { readFileSync } from 'node:fs';

// .env.local 로드 (script 실행 전에 process.env 세팅되어야 함 — 이후 dynamic import)
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
for (const [k, v] of Object.entries(env)) {
  if (!process.env[k]) process.env[k] = v;
}

// 테스트 override — 실제 채용팀 대신 나한테만 보냄
const OVERRIDE_TO = 'younghun@likelion.net';
process.env.NOTIFY_TEAM_OVERRIDE_TO = OVERRIDE_TO;
if (!process.env.NEXT_PUBLIC_SITE_URL) process.env.NEXT_PUBLIC_SITE_URL = 'https://salary-fyi.com';

console.log('\n=== env ===');
console.log('  RESEND_API_KEY:', process.env.RESEND_API_KEY ? `set (${process.env.RESEND_API_KEY.slice(0,8)}…)` : 'MISSING');
console.log('  RESEND_FROM   :', process.env.RESEND_FROM || '(unset)');
console.log('  SITE_URL      :', process.env.NEXT_PUBLIC_SITE_URL);
console.log('  OVERRIDE_TO   :', OVERRIDE_TO);

// dynamic import — 위에서 env 다 세팅된 후 supabaseAdmin 이 초기화되도록
const { createClient } = await import('@supabase/supabase-js');
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

let appId = process.argv[2];

if (!appId) {
  console.log('\n=== picking most recent job_applications row ===');
  const { data: rows, error } = await admin
    .from('job_applications')
    .select('id, applicant_name, applicant_email, job_title, job_company, created_at')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) { console.error('  ✗', error.message); process.exit(1); }
  if (!rows?.length) { console.error('  (no applications yet — apply to any job first, or pass an appId)'); process.exit(1); }
  appId = rows[0].id;
  console.log(`  picked: ${appId}`);
  console.log(`    ${rows[0].applicant_name} <${rows[0].applicant_email}> → ${rows[0].job_title} @ ${rows[0].job_company}`);
} else {
  console.log(`\n=== using provided applicationId: ${appId} ===`);
}

// 실제 알림 발송
const { notifyTeamNewApplication } = await import('../lib/notifyTeamNewApplication.js');
console.log('\n=== sending notification ===');
const result = await notifyTeamNewApplication(appId);
console.log('  result:', JSON.stringify(result, null, 2));

if (result.ok) {
  console.log(`\n✓ Sent. Check inbox: ${OVERRIDE_TO}`);
  console.log(`  (production은 job_team 전원에게 발송됨)`);
} else {
  console.log(`\n✗ Not sent. reason: ${result.reason || '(see results)'}`);
  process.exit(1);
}
