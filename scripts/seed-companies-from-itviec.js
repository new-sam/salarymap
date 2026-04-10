// Seed companies table from ITviec company listings
// Usage: node scripts/seed-companies-from-itviec.js
const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BASE_URL = 'https://itviec.com/companies';
const MAX_PAGES = 50;
const DELAY_MS = 500;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function guessDomain(name, url) {
  if (url) {
    try {
      const u = new URL(url.startsWith('http') ? url : `https://${url}`);
      return u.hostname.replace(/^www\./, '');
    } catch {}
  }
  return null;
}

async function fetchPage(page) {
  const url = page === 1 ? BASE_URL : `${BASE_URL}?page=${page}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
    },
  });
  if (!res.ok) return null;
  return res.text();
}

function parseCompanies(html) {
  const $ = cheerio.load(html);
  const companies = [];

  // ITviec company cards — try multiple selectors
  $('[data-controller="company-card"], .company-card, .company_body, .company-name a, .employer-name a').each((_, el) => {
    const $el = $(el);
    const name = $el.find('.company-name, .employer-name, h2, h3').first().text().trim()
      || $el.text().trim();
    if (name && name.length > 1 && name.length < 100) {
      const href = $el.find('a').attr('href') || $el.attr('href') || '';
      companies.push({ name });
    }
  });

  // Fallback: look for any link with /companies/ in href
  if (companies.length === 0) {
    $('a[href*="/companies/"]').each((_, el) => {
      const name = $(el).text().trim();
      if (name && name.length > 2 && name.length < 100 && !name.includes('›') && !name.includes('page')) {
        companies.push({ name });
      }
    });
  }

  return companies;
}

(async () => {
  let totalInserted = 0;
  let totalSeen = 0;
  const allNames = new Set();

  console.log('=== ITviec Company Seed ===\n');

  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const html = await fetchPage(page);
      if (!html) {
        console.log(`Page ${page}: failed to fetch, stopping.`);
        break;
      }

      const companies = parseCompanies(html);
      if (companies.length === 0) {
        console.log(`Page ${page}: no companies found, stopping.`);
        break;
      }

      // Deduplicate within this run
      const newCompanies = companies.filter(c => {
        if (allNames.has(c.name.toLowerCase())) return false;
        allNames.add(c.name.toLowerCase());
        return true;
      });
      totalSeen += companies.length;

      if (newCompanies.length > 0) {
        const batch = newCompanies.map(c => ({ name: c.name, domain: c.domain || null }));
        const { error } = await supabase
          .from('companies')
          .upsert(batch, { onConflict: 'name', ignoreDuplicates: true });

        if (error) {
          console.log(`Page ${page}: upsert error — ${error.message}`);
        } else {
          totalInserted += newCompanies.length;
          console.log(`Page ${page}: +${newCompanies.length} companies (total: ${totalInserted})`);
        }
      } else {
        console.log(`Page ${page}: all duplicates, skipping.`);
      }

      await sleep(DELAY_MS);
    } catch (e) {
      console.log(`Page ${page}: error — ${e.message}`);
      break;
    }
  }

  console.log(`\n=== Done ===`);
  console.log(`Pages scraped, total seen: ${totalSeen}`);
  console.log(`New companies inserted: ${totalInserted}`);

  // Final count
  const { count } = await supabase.from('companies').select('*', { count: 'exact', head: true });
  console.log(`Companies table total: ${count}`);
})();
