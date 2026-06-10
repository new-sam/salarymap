// READ-ONLY investigation: how does application_source compare to referrer?
// Does NOT modify the database.
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://twpxsbnkypocjfnerfmd.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TARGET_EMAIL = process.argv[2] || 'huynguyenanh24@gmail.com';

async function main() {
  // 1) The specific applicant
  const { data: rows, error } = await supabase
    .from('job_applications')
    .select('id, created_at, applicant_email, applicant_name, job_title, job_company, application_source, referrer, utm_source, utm_medium, utm_campaign, utm_content')
    .eq('applicant_email', TARGET_EMAIL)
    .order('created_at', { ascending: false });

  if (error) { console.error('Query error:', error.message); process.exit(1); }

  console.log(`\n=== Applications for ${TARGET_EMAIL} (${rows.length}) ===`);
  for (const r of rows) {
    console.log(JSON.stringify({
      created_at: r.created_at,
      job: `${r.job_title} @ ${r.job_company}`,
      application_source: r.application_source,
      referrer: r.referrer,
      utm_source: r.utm_source,
      utm_content: r.utm_content,
    }, null, 2));
  }

  // 2) Aggregate: how many "direct" applications actually have a salary referrer?
  const { data: all, error: e2 } = await supabase
    .from('job_applications')
    .select('id, application_source, referrer');
  if (e2) { console.error('Agg error:', e2.message); process.exit(1); }

  const isSalaryRef = (ref) => !!ref && /salary-fyi\.com|salary\.fyi|\/salary/i.test(ref);

  const buckets = {};
  let total = all.length, salaryRefCount = 0, directWithSalaryRef = 0, nullSource = 0;
  for (const r of all) {
    const src = r.application_source || 'NULL';
    buckets[src] = (buckets[src] || 0) + 1;
    if (r.application_source == null) nullSource++;
    if (isSalaryRef(r.referrer)) {
      salaryRefCount++;
      if (src === 'direct' || src === 'NULL') directWithSalaryRef++;
    }
  }

  console.log(`\n=== Aggregate over ${total} job_applications ===`);
  console.log('application_source breakdown:', buckets);
  console.log('rows with salary-looking referrer:', salaryRefCount);
  console.log('  ...of which counted as direct/NULL (the leak):', directWithSalaryRef);
  console.log('rows with NULL application_source (migration gap):', nullSource);

  // 3) Sample distinct referrer values to understand what's actually stored
  const refCounts = {};
  for (const r of all) {
    const key = r.referrer ? r.referrer.replace(/\?.*$/, '') : '(null)';
    refCounts[key] = (refCounts[key] || 0) + 1;
  }
  const top = Object.entries(refCounts).sort((a, b) => b[1] - a[1]).slice(0, 25);
  console.log('\n=== Top referrer values (query stripped) ===');
  for (const [k, v] of top) console.log(`${String(v).padStart(5)}  ${k}`);
}

main();
