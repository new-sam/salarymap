// READ-ONLY schema probe for talent-pool matching
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('/Users/wiseungju/salarymap/.env.local', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: jobSample } = await admin.from('jobs').select('*').limit(1);
console.log('=== JOBS columns ===');
console.log(Object.keys(jobSample?.[0] || {}).join(', '));

const { data: profSample } = await admin.from('user_profiles').select('*').limit(1);
console.log('\n=== user_profiles columns ===');
console.log(Object.keys(profSample?.[0] || {}).join(', '));

// count active company_self jobs
const { count: jobCount } = await admin.from('jobs').select('*', { count: 'exact', head: true }).eq('source', 'company_self');
console.log('\ncompany_self jobs total:', jobCount);

const { count: profCount } = await admin.from('user_profiles').select('*', { count: 'exact', head: true });
console.log('user_profiles total:', profCount);
const { count: resumeCount } = await admin.from('user_profiles').select('*', { count: 'exact', head: true }).not('resume_url', 'is', null);
console.log('with resume_url:', resumeCount);
