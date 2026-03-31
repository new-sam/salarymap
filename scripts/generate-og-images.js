// Run once: node scripts/generate-og-images.js
// Scrapes og:image from company homepages → saves to lib/ogImages.json
const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const OUT = path.join(__dirname, '..', 'lib', 'ogImages.json');

const COMPANY_DOMAINS = {
  'Grab Vietnam':    'https://www.grab.com/vn/',
  'VNG Corporation': 'https://www.vng.com.vn',
  'Shopee Vietnam':  'https://shopee.vn',
  'FPT Software':    'https://fptsoftware.com',
  'Momo':            'https://momo.vn',
  'Sky Mavis':       'https://skymavis.com',
  'Tiki':            'https://tiki.vn',
  'Zalo':            'https://zalo.me',
  'VPBank':          'https://www.vpbank.com.vn',
  'Techcombank':     'https://www.techcombank.com.vn',
  'VNPT Technology': 'https://www.vnpt.com.vn',
  'OneMount Group':  'https://onemount.com',
  'GHN':             'https://ghn.vn',
  'NashTech':        'https://nashtechglobal.com',
  'KMS Technology':  'https://kms-technology.com',
};

function fetchOgImage(pageUrl) {
  return new Promise((resolve) => {
    const parsed = url.parse(pageUrl);
    const lib = parsed.protocol === 'https:' ? https : http;
    const opts = {
      hostname: parsed.hostname,
      path: parsed.path || '/',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    };
    const req = lib.get(opts, (res) => {
      // Follow single redirect
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        return fetchOgImage(res.headers.location).then(resolve);
      }
      let body = '';
      res.on('data', chunk => {
        body += chunk;
        // Stop after 50KB — og:image is always in <head>
        if (body.length > 50000) req.destroy();
      });
      res.on('end', () => {
        // Match og:image content="..."
        const m = body.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
               || body.match(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
        if (m) {
          let imgUrl = m[1].trim();
          // Resolve relative URLs
          if (imgUrl.startsWith('//')) imgUrl = parsed.protocol + imgUrl;
          else if (imgUrl.startsWith('/')) imgUrl = `${parsed.protocol}//${parsed.hostname}${imgUrl}`;
          else if (!imgUrl.startsWith('http')) imgUrl = `${parsed.protocol}//${parsed.hostname}/${imgUrl}`;
          resolve(imgUrl);
        } else {
          resolve(null);
        }
      });
      res.on('error', () => resolve(null));
    });
    req.on('error', () => resolve(null));
    req.setTimeout(12000, () => { req.destroy(); resolve(null); });
  });
}

async function run() {
  let existing = {};
  if (fs.existsSync(OUT)) {
    existing = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    console.log('Loaded', Object.keys(existing).length, 'existing entries\n');
  }

  const result = { ...existing };

  for (const [company, pageUrl] of Object.entries(COMPANY_DOMAINS)) {
    if (existing[company]) {
      console.log('  ⏭ ', company, '(cached)');
      continue;
    }
    process.stdout.write(`  ⏳  ${company} ...`);
    const imgUrl = await fetchOgImage(pageUrl);
    if (imgUrl) {
      result[company] = imgUrl;
      console.log('\r  ✓ ', company);
      console.log('      ', imgUrl);
    } else {
      console.log('\r  –  ', company, '(no og:image)');
    }
    await new Promise(r => setTimeout(r, 500));
  }

  fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log('\nSaved', Object.keys(result).length, 'images to lib/ogImages.json');
}

run();
