// Read-only smoke check + single ping mail to confirm Resend pipeline works.
// Run with: node scripts/check-mail.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY   = env.RESEND_API_KEY;
const RESEND_FROM  = env.RESEND_FROM || 'FYI test <onboarding@resend.dev>';
const PING_TO      = 'kee@likelion.net';

console.log('\n=== env ===');
console.log('  RESEND_API_KEY:', RESEND_KEY ? `set (${RESEND_KEY.slice(0,8)}…)` : 'MISSING');
console.log('  RESEND_FROM   :', env.RESEND_FROM || `(unset → fallback: ${RESEND_FROM})`);

// --- 1) mail log -----------------------------------------------------------
const admin = createClient(SUPABASE_URL, SERVICE_KEY);
const { data: logs, error: logErr } = await admin
  .from('recruiter_mail_log')
  .select('id, to_email, subject, template_key, status, sent_by, created_at')
  .order('created_at', { ascending: false })
  .limit(20);

console.log('\n=== recruiter_mail_log (latest 20) ===');
if (logErr) console.log('  ✗', logErr.message);
else if (!logs?.length) console.log('  (empty — no sends attempted yet via send-mail.js)');
else {
  const sent = logs.filter(l => l.status === 'sent').length;
  const failed = logs.filter(l => l.status === 'failed').length;
  console.log(`  total=${logs.length}  sent=${sent}  failed=${failed}`);
  logs.slice(0, 8).forEach(l => {
    const when = new Date(l.created_at).toISOString().replace('T',' ').slice(0,19);
    console.log(`  ${when}  [${l.status}]  to=${l.to_email}  tpl=${l.template_key || '-'}`);
  });
}

// --- 2) Resend ping --------------------------------------------------------
console.log(`\n=== Resend ping → ${PING_TO} ===`);
console.log(`  from: ${RESEND_FROM}`);
const pingRes = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: RESEND_FROM,
    to: PING_TO,
    subject: '[FYI ATS] 메일 파이프라인 점검 (ping)',
    text: 'FYI ATS 메일 송수신 점검입니다. 이 메일이 도착했다면 send-mail.js 파이프라인이 작동합니다.',
  }),
});
const pingJson = await pingRes.json().catch(() => ({}));
console.log(`  HTTP ${pingRes.status}`);
if (pingRes.ok) {
  console.log(`  ✓ Resend accepted the request. id=${pingJson.id}`);
  console.log(`  → check inbox (and spam folder) of ${PING_TO}.`);
  console.log(`  → 도착하면 파이프라인 OK. 도착 안하면 Resend dashboard → Logs에서 상태 확인.`);
} else {
  console.log(`  ✗ Resend rejected:`, pingJson?.message || pingJson?.name || JSON.stringify(pingJson));
}

console.log('');
