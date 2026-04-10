// STEP 2 — Junk detection script (DRY RUN — does NOT modify database)
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://twpxsbnkypocjfnerfmd.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })
  && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Vietnamese-aware Latin test
const LATIN_VIET_RE = /^[\w\s\-.'&()àáảãạăắặẳẵằâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵÀÁẢÃẠĂẮẶẲẴẰÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ]+$/i;
const TEST_RE = /^(test|qwer|asdf|qwd|dwd|abc|xxx|123|fgf)/i;
const GIBBERISH_RE = /^[A-Z]{4,}$/; // all-caps 4+ chars with no vowels or common patterns
const RANDOM_STRINGS = ['WQDQWDQWDWQD','WEFQWDQWDQW','QWDQWD','DWDWD','DQWD','2dwqd','TOSSSS'];

function isJunkCompany(name) {
  if (!name || name.length < 2) return 'too_short';
  if (TEST_RE.test(name)) return 'test_name';
  if (RANDOM_STRINGS.includes(name)) return 'random_string';
  if (!LATIN_VIET_RE.test(name)) return 'non_latin_viet';
  if (GIBBERISH_RE.test(name) && !/[AEIOU]/.test(name)) return 'gibberish';
  return null;
}

function isJunkSalary(salary, q25, q75) {
  const iqr = q75 - q25;
  const lower = q25 - 1.5 * iqr;
  const upper = q75 + 1.5 * iqr;
  // Extreme outliers only (values that are clearly data entry errors, not just high earners)
  if (salary > 200) return 'extreme_salary'; // slider max is 200
  if (salary < 5) return 'below_minimum';    // slider min is 5
  return null;
}

(async () => {
  const { data, error } = await supabase.from('submissions').select('*');
  if (error) { console.error('DB error:', error); process.exit(1); }

  // Calculate salary quartiles from all data
  const allSalaries = data.map(r => r.salary).filter(s => s != null).sort((a, b) => a - b);
  const q25 = allSalaries[Math.floor(allSalaries.length * 0.25)];
  const q75 = allSalaries[Math.floor(allSalaries.length * 0.75)];

  const junkIds = [];
  const junkDetails = [];
  const validCompanies = new Set();

  for (const row of data) {
    const companyReason = isJunkCompany(row.company);
    const salaryReason = isJunkSalary(row.salary, q25, q75);
    const reason = companyReason || salaryReason;

    if (reason) {
      junkIds.push(row.id);
      junkDetails.push({
        id: row.id,
        company: row.company,
        salary: row.salary,
        role: row.role,
        reason,
      });
    } else {
      validCompanies.add(row.company);
    }
  }

  // Summary
  console.log('=== JUNK DETECTION SUMMARY ===');
  console.log(`Total records:  ${data.length}`);
  console.log(`Junk records:   ${junkIds.length}`);
  console.log(`Valid records:  ${data.length - junkIds.length}`);
  console.log(`Valid companies: ${validCompanies.size}`);

  console.log('\n=== JUNK BREAKDOWN ===');
  const reasons = {};
  junkDetails.forEach(j => { reasons[j.reason] = (reasons[j.reason] || 0) + 1; });
  Object.entries(reasons).sort((a,b) => b[1]-a[1]).forEach(([r, c]) => console.log(`  ${r}: ${c}`));

  console.log('\n=== JUNK RECORDS ===');
  junkDetails.forEach(j => {
    console.log(`  ${j.reason.padEnd(16)} | ${(j.company||'').padEnd(20)} | salary: ${j.salary} | ${j.role}`);
  });

  // Write outputs
  const outDir = path.resolve(__dirname);
  fs.writeFileSync(path.join(outDir, 'junk-ids.json'), JSON.stringify(junkIds, null, 2));
  fs.writeFileSync(path.join(outDir, 'valid-companies.json'), JSON.stringify([...validCompanies].sort(), null, 2));

  console.log(`\n✓ Written: scripts/junk-ids.json (${junkIds.length} IDs)`);
  console.log(`✓ Written: scripts/valid-companies.json (${validCompanies.size} companies)`);
  console.log('\nDRY RUN complete — review junk-ids.json before applying.');
})();
