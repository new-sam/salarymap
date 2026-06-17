// One-off: extract + count user emails for the iOS app-launch announcement.
// Sourced from auth.users (true signups) — user_profiles misses ~half who never
// completed the client-side profile save. Excludes recruiter (company) accounts.
// READ-ONLY on the database. Writes a local CSV (scripts/app-launch-emails.csv).
// Run with: node scripts/export-app-launch-emails.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// --- auth.users (true signups; paginate, max perPage 1000) ------------------
let page = 1, authUsers = [];
for (;;) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) { console.error('✗ listUsers failed:', error.message); process.exit(1); }
  authUsers.push(...data.users);
  if (data.users.length < 1000) break;
  page++;
}

// --- recruiter (company) accounts to exclude --------------------------------
let recruiterIds = new Set();
{
  const { data, error } = await admin.from('recruiter_users').select('user_id');
  if (error) console.log('  (recruiter_users skipped:', error.message, ')');
  else recruiterIds = new Set(data.map(r => r.user_id));
}

// --- full_name lookup from user_profiles (nice-to-have for personalization) -
const nameById = new Map();
{
  const PAGE = 1000; let from = 0;
  for (;;) {
    const { data, error } = await admin.from('user_profiles').select('id, full_name').range(from, from + PAGE - 1);
    if (error) break;
    data.forEach(p => { if (p.full_name) nameById.set(p.id, p.full_name); });
    if (data.length < PAGE) break;
    from += PAGE;
  }
}

// --- clean: valid + confirmed email, drop recruiters, dedup (case-insensitive)
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const EXCLUDE_DOMAINS = ['likelion.net']; // internal team accounts
const seen = new Map();
let nullCount = 0, invalidCount = 0, recruiterCount = 0, unconfirmedCount = 0, internalCount = 0;
for (const u of authUsers) {
  if (recruiterIds.has(u.id)) { recruiterCount++; continue; }
  const email = (u.email || '').trim().toLowerCase();
  if (!email) { nullCount++; continue; }
  if (!EMAIL_RE.test(email)) { invalidCount++; continue; }
  if (EXCLUDE_DOMAINS.some(d => email.endsWith('@' + d))) { internalCount++; continue; }
  if (!(u.email_confirmed_at || u.confirmed_at)) { unconfirmedCount++; continue; }
  const full_name = nameById.get(u.id) || u.user_metadata?.full_name || u.user_metadata?.name || '';
  if (!seen.has(email)) seen.set(email, { email, full_name, created_at: u.created_at });
}

const list = [...seen.values()];

console.log('\n=== auth.users export (excl. recruiters) ===');
console.log('  total auth users   :', authUsers.length);
console.log('  recruiter excluded :', recruiterCount);
console.log('  likelion.net excl. :', internalCount);
console.log('  null/empty email   :', nullCount);
console.log('  invalid email      :', invalidCount);
console.log('  unconfirmed (skip) :', unconfirmedCount);
console.log('  unique mailable    :', list.length);

// --- write CSV (Resend Audience import format) ------------------------------
const csv = ['email,first_name,last_name']
  .concat(list.map(r => {
    const [first, ...rest] = (r.full_name || '').split(' ');
    const esc = s => `"${String(s).replace(/"/g, '""')}"`;
    return [r.email, esc(first || ''), esc(rest.join(' '))].join(',');
  }))
  .join('\n');
const outPath = new URL('./app-launch-emails.csv', import.meta.url);
writeFileSync(outPath, csv);
console.log('\n✓ wrote', list.length, 'rows →', outPath.pathname);
console.log('');
