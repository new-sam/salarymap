// STEP 3 — Company name normalization (DRY RUN)
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://twpxsbnkypocjfnerfmd.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })
  && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Manual alias mapping (from audit results)
const ALIASES = {
  'grab': 'Grab Vietnam',
  'vng': 'VNG Corporation',
  'likelion': 'LikeLion Vietnam',
  'likelion vn': 'LikeLion Vietnam',
  'nashtech global': 'NashTech',
  'nashtech': 'NashTech',
  'toss': 'Toss Vietnam',
  'tossss': 'Toss Vietnam',
  'ghn': 'GHN Express',
};

function titleCase(str) {
  return str.replace(/\b\w+/g, w =>
    w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()
  );
}

(async () => {
  // Fetch canonical company names from companies table
  const { data: companiesTable } = await supabase.from('companies').select('name');
  const canonicalNames = new Map();
  if (companiesTable) {
    companiesTable.forEach(c => canonicalNames.set(c.name.toLowerCase(), c.name));
  }

  // Fetch all submissions
  const { data: submissions } = await supabase.from('submissions').select('id, company');

  // Load junk IDs to skip
  let junkIds = new Set();
  try {
    const junk = JSON.parse(fs.readFileSync(path.join(__dirname, 'junk-ids.json'), 'utf8'));
    junkIds = new Set(junk);
  } catch (e) {
    console.warn('⚠ junk-ids.json not found — run clean-submissions.js first');
  }

  const normMap = {};
  const seen = new Set();

  for (const row of submissions) {
    if (junkIds.has(row.id)) continue;
    const original = (row.company || '').trim();
    if (!original || seen.has(original)) continue;
    seen.add(original);

    let normalized = original;

    // 1. Trim whitespace (already done)
    // 2. Alias mapping
    const lower = normalized.toLowerCase();
    if (ALIASES[lower]) {
      normalized = ALIASES[lower];
    }
    // 3. Match against companies table (case-insensitive)
    else if (canonicalNames.has(lower)) {
      normalized = canonicalNames.get(lower);
    }
    // 4. Title-case all-lowercase names
    else if (normalized === normalized.toLowerCase()) {
      normalized = titleCase(normalized);
    }

    if (normalized !== original) {
      normMap[original] = normalized;
    }
  }

  console.log('=== NORMALIZATION MAP ===');
  Object.entries(normMap).forEach(([from, to]) => {
    console.log(`  "${from}" → "${to}"`);
  });
  console.log(`\nTotal normalizations: ${Object.keys(normMap).length}`);

  fs.writeFileSync(
    path.join(__dirname, 'normalization-map.json'),
    JSON.stringify(normMap, null, 2)
  );
  console.log('✓ Written: scripts/normalization-map.json');
})();
