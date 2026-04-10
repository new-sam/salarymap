// STEP 4 — Company enrichment via domain/logo (DRY RUN)
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://twpxsbnkypocjfnerfmd.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })
  && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Known domain mappings
const DOMAIN_MAP = {
  'Grab Vietnam': 'grab.com',
  'Tiki': 'tiki.vn',
  'VNG Corporation': 'vng.com.vn',
  'FPT Software': 'fpt.com',
  'Momo': 'momo.vn',
  'MoMo': 'momo.vn',
  'Zalo': 'zalo.me',
  'VPBank': 'vpbank.com.vn',
  'Shopee Vietnam': 'shopee.vn',
  'Techcombank': 'techcombank.com.vn',
  'Sky Mavis': 'skymavis.com',
  'VNPT Technology': 'vnpt-technology.vn',
  'SHB Finance': 'shbfinance.com.vn',
  'OneMount Group': 'onemount.com',
  'Logivan': 'logivan.com',
  'Base.vn': 'base.vn',
  'Sendo': 'sendo.vn',
  'GHN Express': 'ghn.vn',
  'Rever': 'rfrever.vn',
  'NashTech': 'nashtechglobal.com',
  'KiotViet': 'kiotviet.vn',
  'TokyoTech VN': 'tokyotechlab.com',
  'Got It': 'got-it.ai',
  'Katalon': 'katalon.com',
  'Harvey Nash': 'harveynash.vn',
  'Axon Active': 'axonactive.com',
  'Teko Vietnam': 'teko.vn',
  'BHD Star': 'bhdstar.vn',
  'Viettel': 'viettel.com.vn',
  'Sacombank Digital': 'sacombank.com.vn',
  'KMS Technology': 'kms-technology.com',
  'Amanotes': 'amanotes.com',
  'MBBank': 'mbbank.com.vn',
  'Fossil Group VN': 'fossil.com',
  'Trusting Social': 'trustingsocial.com',
  'LikeLion Vietnam': 'likelion.net',
  'Toss Vietnam': 'toss.im',
};

async function checkLogo(domain) {
  try {
    const res = await fetch(`https://logo.clearbit.com/${domain}`, { method: 'HEAD' });
    return res.status === 200;
  } catch {
    return false;
  }
}

(async () => {
  const { data: companies } = await supabase.from('companies').select('*');
  const applyMode = process.argv.includes('--apply');

  console.log('=== COMPANY ENRICHMENT ===');
  console.log(`Companies in table: ${companies?.length || 0}\n`);

  const results = [];

  for (const co of (companies || [])) {
    const knownDomain = DOMAIN_MAP[co.name];
    const currentDomain = co.domain;
    const domain = currentDomain || knownDomain || null;

    let logoOk = false;
    if (domain) {
      logoOk = await checkLogo(domain);
    }

    results.push({
      name: co.name,
      currentDomain: currentDomain || null,
      newDomain: domain,
      logoOk,
    });

    const status = logoOk ? '✓' : domain ? '✗ logo 404' : '— no domain';
    console.log(`  ${status.padEnd(14)} ${co.name.padEnd(22)} ${domain || ''}`);
  }

  // Also check valid companies from submissions not in companies table
  let validCompanies = [];
  try {
    validCompanies = JSON.parse(fs.readFileSync(path.join(__dirname, 'valid-companies.json'), 'utf8'));
  } catch {}

  const existingNames = new Set((companies || []).map(c => c.name.toLowerCase()));
  const missing = validCompanies.filter(name => !existingNames.has(name.toLowerCase()));

  if (missing.length > 0) {
    console.log(`\n=== MISSING FROM companies TABLE (${missing.length}) ===`);
    missing.forEach(name => {
      const domain = DOMAIN_MAP[name] || null;
      console.log(`  + ${name.padEnd(22)} ${domain || '(no domain)'}`);
    });
  }

  if (applyMode) {
    console.log('\n=== APPLYING DOMAIN UPDATES ===');
    for (const r of results) {
      if (r.newDomain && r.newDomain !== r.currentDomain && r.logoOk) {
        const { error } = await supabase
          .from('companies')
          .update({ domain: r.newDomain })
          .eq('name', r.name);
        if (error) console.log(`  ✗ ${r.name}: ${error.message}`);
        else console.log(`  ✓ ${r.name} → ${r.newDomain}`);
      }
    }
    console.log('Domain updates applied.');
  } else {
    console.log('\nDRY RUN complete — pass --apply to update domains in database.');
  }

  fs.writeFileSync(
    path.join(__dirname, 'enrichment-report.json'),
    JSON.stringify(results, null, 2)
  );
  console.log('✓ Written: scripts/enrichment-report.json');
})();
