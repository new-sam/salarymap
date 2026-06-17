// Resend Broadcast pipeline for the iOS app-launch announcement (Vietnamese).
// Steps (run in order):
//   node scripts/launch-broadcast.mjs audience            → create audience + upload 682 contacts
//   node scripts/launch-broadcast.mjs audience <audId>    → add contacts to an EXISTING audience (resume)
//   node scripts/launch-broadcast.mjs create   <audId>    → create the broadcast DRAFT (not sent)
//   node scripts/launch-broadcast.mjs send     <bcastId>  → SEND for real (irreversible)
import { Resend } from 'resend';
import { readFileSync } from 'node:fs';
import { buildHtml, COPY, env } from './launch-email.mjs';

const resend = new Resend(env.RESEND_API_KEY);
const LANG = 'vi';
const AUDIENCE_NAME = 'salary-fyi users — iOS launch';

function readCsv() {
  const lines = readFileSync(new URL('./app-launch-emails.csv', import.meta.url), 'utf8').trim().split('\n');
  lines.shift(); // header
  return lines.map(l => {
    const m = l.match(/^([^,]+),"((?:[^"]|"")*)","((?:[^"]|"")*)"$/);
    if (!m) { return { email: l.split(',')[0], first: '', last: '' }; }
    return { email: m[1], first: m[2].replace(/""/g, '"'), last: m[3].replace(/""/g, '"') };
  });
}

const [mode, arg] = process.argv.slice(2);

if (mode === 'audience') {
  let audienceId = arg;
  if (!audienceId) {
    const { data, error } = await resend.audiences.create({ name: AUDIENCE_NAME });
    if (error) { console.error('✗ audience create:', error.message); process.exit(1); }
    audienceId = data.id;
    console.log('✓ audience created:', audienceId);
  } else {
    console.log('→ adding to existing audience:', audienceId);
  }
  const rows = readCsv();
  console.log(`uploading ${rows.length} contacts…`);
  let ok = 0, fail = 0;
  for (const r of rows) {
    const { error } = await resend.contacts.create({
      audienceId, email: r.email, firstName: r.first, lastName: r.last, unsubscribed: false,
    });
    if (error) { fail++; if (fail <= 8) console.log('  ✗', r.email, '—', error.message); }
    else ok++;
    if ((ok + fail) % 100 === 0) console.log(`  …${ok + fail}/${rows.length}`);
    await new Promise(s => setTimeout(s, 150)); // ~6/s, safely under rate limit
  }
  console.log(`✓ done — added: ${ok}, failed: ${fail}`);
  console.log(`→ next: node scripts/launch-broadcast.mjs create ${audienceId}`);
}

else if (mode === 'create') {
  const audienceId = arg;
  if (!audienceId) { console.error('audienceId required'); process.exit(1); }
  const c = COPY[LANG];
  const html = buildHtml(LANG, '{{{RESEND_UNSUBSCRIBE_URL}}}'); // Resend injects real unsub URL
  const { data, error } = await resend.broadcasts.create({
    audienceId, from: env.RESEND_FROM, subject: c.subject, name: 'iOS launch announcement (vi)', html,
  });
  if (error) { console.error('✗ broadcast create:', error.message); process.exit(1); }
  console.log('✓ broadcast DRAFT created:', data.id);
  console.log('→ review in Resend dashboard → Broadcasts (preview + recipient count)');
  console.log(`→ then send: node scripts/launch-broadcast.mjs send ${data.id}   (or hit Send in dashboard)`);
}

else if (mode === 'send') {
  const id = arg;
  if (!id) { console.error('broadcastId required'); process.exit(1); }
  const { data, error } = await resend.broadcasts.send(id);
  if (error) { console.error('✗ send:', error.message); process.exit(1); }
  console.log('✓ BROADCAST SENT:', JSON.stringify(data));
}

else {
  console.log('usage: audience [audId] | create <audId> | send <bcastId>');
}
