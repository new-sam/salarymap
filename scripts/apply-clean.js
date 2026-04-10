// STEP 5 — Apply cleaning to database
// REQUIRES: --apply flag to actually modify data
// REQUIRES: SUPABASE_SERVICE_ROLE_KEY env var for write operations
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://twpxsbnkypocjfnerfmd.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })
  && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const applyMode = process.argv.includes('--apply');

function loadJSON(filename) {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, filename), 'utf8'));
  } catch (e) {
    console.error(`✗ Could not read ${filename}: ${e.message}`);
    return null;
  }
}

(async () => {
  const junkIds = loadJSON('junk-ids.json');
  const normMap = loadJSON('normalization-map.json');
  const validCompanies = loadJSON('valid-companies.json');

  if (!junkIds || !normMap || !validCompanies) {
    console.error('Missing input files. Run clean-submissions.js and normalize-companies.js first.');
    process.exit(1);
  }

  console.log('=== APPLY CLEANING PLAN ===');
  console.log(`Mode: ${applyMode ? '🔴 LIVE — MODIFYING DATABASE' : '🟢 DRY RUN'}`);
  console.log(`Junk to delete:      ${junkIds.length} submissions`);
  console.log(`Names to normalize:  ${Object.keys(normMap).length} mappings`);

  // Check for companies not yet in companies table
  const { data: existingCompanies } = await supabase.from('companies').select('name');
  const existingSet = new Set((existingCompanies || []).map(c => c.name.toLowerCase()));

  // Build list of valid company names after normalization
  const allValidNames = new Set();
  for (const name of validCompanies) {
    const normalized = normMap[name] || name;
    allValidNames.add(normalized);
  }
  const missingCompanies = [...allValidNames].filter(n => !existingSet.has(n.toLowerCase()));

  console.log(`Companies to insert: ${missingCompanies.length}`);
  if (missingCompanies.length > 0) {
    console.log('  New:', missingCompanies.join(', '));
  }

  if (!applyMode) {
    console.log('\n--- DELETE preview (first 10) ---');
    junkIds.slice(0, 10).forEach(id => console.log(`  DELETE id: ${id}`));
    if (junkIds.length > 10) console.log(`  ... and ${junkIds.length - 10} more`);

    console.log('\n--- NORMALIZE preview ---');
    Object.entries(normMap).forEach(([from, to]) => {
      console.log(`  "${from}" → "${to}"`);
    });

    console.log('\nDRY RUN complete — review output before applying.');
    console.log('Run with --apply flag to execute changes.');
    return;
  }

  // === APPLY MODE ===

  // 1. Delete junk submissions (in batches of 50)
  console.log('\n--- Deleting junk submissions ---');
  for (let i = 0; i < junkIds.length; i += 50) {
    const batch = junkIds.slice(i, i + 50);
    const { error } = await supabase
      .from('submissions')
      .delete()
      .in('id', batch);
    if (error) console.error(`  ✗ Batch ${i}: ${error.message}`);
    else console.log(`  ✓ Deleted batch ${i}-${i + batch.length}`);
  }

  // 2. Apply normalization
  console.log('\n--- Normalizing company names ---');
  for (const [original, canonical] of Object.entries(normMap)) {
    const { error, count } = await supabase
      .from('submissions')
      .update({ company: canonical })
      .eq('company', original);
    if (error) console.error(`  ✗ "${original}": ${error.message}`);
    else console.log(`  ✓ "${original}" → "${canonical}"`);
  }

  // 3. Insert missing companies
  if (missingCompanies.length > 0) {
    console.log('\n--- Inserting missing companies ---');
    const rows = missingCompanies.map(name => ({ name }));
    const { error } = await supabase.from('companies').insert(rows);
    if (error) console.error(`  ✗ Insert error: ${error.message}`);
    else console.log(`  ✓ Inserted ${missingCompanies.length} companies`);
  }

  // Final count
  const { count } = await supabase.from('submissions').select('*', { count: 'exact', head: true });
  console.log(`\n✅ Done. Remaining submissions: ${count}`);
})();
