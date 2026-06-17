// Diagnostic: compare auth.users (true signups) vs user_profiles. READ-ONLY.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// --- auth.users (paginate; max perPage 1000) --------------------------------
let page = 1, authUsers = [];
for (;;) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) { console.error('✗ listUsers failed:', error.message); process.exit(1); }
  authUsers.push(...data.users);
  if (data.users.length < 1000) break;
  page++;
}

// --- user_profiles ids/emails -----------------------------------------------
const PAGE = 1000;
let from = 0, profiles = [];
for (;;) {
  const { data, error } = await admin.from('user_profiles').select('id, email').range(from, from + PAGE - 1);
  if (error) { console.error('✗ profiles failed:', error.message); process.exit(1); }
  profiles.push(...data);
  if (data.length < PAGE) break;
  from += PAGE;
}
const profileIds = new Set(profiles.map(p => p.id));

// --- recruiter_users (company accounts — likely exclude) --------------------
let recruiterIds = new Set();
{
  const { data, error } = await admin.from('recruiter_users').select('user_id');
  if (error) console.log('  (recruiter_users skipped:', error.message, ')');
  else recruiterIds = new Set(data.map(r => r.user_id));
}

const withEmail = authUsers.filter(u => (u.email || '').includes('@'));
const confirmed = withEmail.filter(u => u.email_confirmed_at || u.confirmed_at);
const missingProfile = withEmail.filter(u => !profileIds.has(u.id));
const recruiters = withEmail.filter(u => recruiterIds.has(u.id));
const provider = {};
withEmail.forEach(u => { const p = u.app_metadata?.provider || '?'; provider[p] = (provider[p] || 0) + 1; });

console.log('\n=== auth.users (true signups) ===');
console.log('  total auth users      :', authUsers.length);
console.log('  with email            :', withEmail.length);
console.log('  email confirmed       :', confirmed.length);
console.log('  by provider           :', JSON.stringify(provider));
console.log('\n=== overlap with user_profiles ===');
console.log('  user_profiles rows    :', profiles.length);
console.log('  auth users w/o profile:', missingProfile.length);
console.log('\n=== recruiter (company) accounts ===');
console.log('  recruiter_users       :', recruiterIds.size, '(consider excluding from consumer-app email)');
console.log('  → consumer audience ≈ auth-with-email minus recruiters =', withEmail.length - recruiters.length);
console.log('');
