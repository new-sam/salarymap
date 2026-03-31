// Run once to pre-fetch Unsplash images: node scripts/generate-images.js
const https = require('https');
const fs = require('fs');
const path = require('path');

const KEY = process.env.UNSPLASH_ACCESS_KEY || 'Bl0my4LsbC7P9UkfePGwYlXp9gdZ6BK_9p8e6YOQ6Rc';
const OUT = path.join(__dirname, '..', 'lib', 'companyImages.json');

const companies = [
  "Tiki","Grab Vietnam","FPT Software","VNG Corporation","Momo","Zalo",
  "VPBank","Shopee Vietnam","Techcombank","Sky Mavis","VNPT Technology",
  "SHB Finance","OneMount Group","Logivan","Base.vn","Sendo","GHN",
  "Rever","NashTech","KiotViet","TokyoTech VN","Got It","Katalon",
  "Harvey Nash","Axon Active","Teko Vietnam","BHD Star","Viettel",
  "Sacombank Digital","KMS Technology","Amanotes","MBBank",
  "Fossil Group VN","Trusting Social","Nashtech Global"
];

function fetchOne(company) {
  return new Promise((resolve) => {
    const q = encodeURIComponent(company + ' Vietnam tech');
    const opts = {
      hostname: 'api.unsplash.com',
      path: '/search/photos?query=' + q + '&per_page=1&orientation=landscape',
      headers: { 'Authorization': 'Client-ID ' + KEY }
    };
    https.get(opts, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          const d = JSON.parse(body);
          if (d.errors || body.includes('Rate Limit')) {
            console.log('  ✗', company, '— rate limited, stopping');
            resolve(null);
            return;
          }
          const url = d?.results?.[0]?.urls?.regular || null;
          console.log(url ? '  ✓' : '  –', company, url ? '' : '(no result)');
          resolve(url);
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

async function run() {
  // Load existing cache so we don't re-fetch what we already have
  let existing = {};
  if (fs.existsSync(OUT)) {
    existing = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    console.log('Loaded', Object.keys(existing).length, 'existing entries');
  }

  const result = { ...existing };
  const toFetch = companies.filter(c => !existing[c]);
  console.log('Fetching', toFetch.length, 'companies...\n');

  for (const company of toFetch) {
    const url = await fetchOne(company);
    if (url === null && !result[company]) {
      // rate limited — stop to preserve remaining quota
      break;
    }
    if (url) result[company] = url;
    await new Promise(r => setTimeout(r, 1300));
  }

  fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log('\nSaved', Object.keys(result).length, 'images to lib/companyImages.json');
}

run();
