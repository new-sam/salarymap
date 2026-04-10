import supabase from '../../lib/supabase';

function removeOutliers(arr) {
  if (arr.length < 4) return arr;
  const sorted = [...arr].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  return sorted.filter(s => s >= q1 - 1.5 * iqr && s <= q3 + 1.5 * iqr);
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? Math.round((s[m - 1] + s[m]) / 2) : s[m];
}

const JUNK_RE = /[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F\u4E00-\u9FFF\u3040-\u30FF]/;
const TEST_RE = /^(test|qwer|asdf|abc|xxx|123|qwd|dwd|fgf|zzz)/i;

function isJunk(company) {
  if (!company || company.trim().length < 2) return true;
  if (JUNK_RE.test(company)) return true;
  if (TEST_RE.test(company.trim())) return true;
  if (company.replace(/[a-zA-ZÀ-ỹ0-9\s.\-&,'()\/]/g, '').length > company.length * 0.4) return true;
  return false;
}

// Domain lookup — companies table has no domain column yet, so we use a hardcoded map
const DOMAIN_MAP = {
  'grab': 'grab.com',
  'grab vietnam': 'grab.com',
  'vng corporation': 'vng.com.vn',
  'shopee vietnam': 'shopee.vn',
  'fpt software': 'fpt.com.vn',
  'tiki': 'tiki.vn',
  'momo': 'momo.vn',
  'zalo': 'zalo.me',
  'vpbank': 'vpbank.com.vn',
  'techcombank': 'techcombank.com.vn',
  'sky mavis': 'skymavis.com',
  'vnpt technology': 'vnpt.com.vn',
  'shb finance': 'shbfinance.com.vn',
  'onemount group': 'onemount.com',
  'logivan': 'logivan.com',
  'base.vn': 'base.vn',
  'sendo': 'sendo.vn',
  'ghn': 'ghn.vn',
  'ghn express': 'ghn.vn',
  'rever': 'rever.vn',
  'nashtech': 'nashtechglobal.com',
  'nashtech global': 'nashtechglobal.com',
  'kiotviet': 'kiotviet.vn',
  'tokyotech vn': 'tokyotechlab.com',
  'got it': 'got-it.ai',
  'katalon': 'katalon.com',
  'harvey nash': 'harveynash.vn',
  'axon active': 'axonactive.com',
  'teko vietnam': 'teko.vn',
  'bhd star': 'bhdstar.vn',
  'viettel': 'viettel.com.vn',
  'sacombank digital': 'sacombank.com.vn',
  'kms technology': 'kms-technology.com',
  'amanotes': 'amanotes.com',
  'mbbank': 'mbbank.com.vn',
  'fossil group vn': 'fossil.com',
  'trusting social': 'trustingsocial.com',
  'likelion vietnam': 'likelion.net',
  'toss vietnam': 'toss.im',
};

function lookupDomain(companyName) {
  return DOMAIN_MAP[companyName.toLowerCase()] || null;
}

export default async function handler(req, res) {
  const { data, error } = await supabase
    .from('submissions')
    .select('company, salary, role');

  if (error) return res.status(500).json({ error: error.message });

  // Aggregate by company
  const map = {};
  data.forEach(({ company, salary, role }) => {
    if (isJunk(company)) return;
    if (salary < 5 || salary > 200) return;
    const key = company.trim();
    if (!map[key]) map[key] = { company: key, salaries: [], roles: {} };
    map[key].salaries.push(salary);
    map[key].roles[role] = (map[key].roles[role] || 0) + 1;
  });

  const result = Object.values(map)
    .filter(c => c.salaries.length >= 3)
    .map(c => {
      const clean = removeOutliers(c.salaries);
      const sorted = [...clean].sort((a, b) => a - b);
      const domain = lookupDomain(c.company);
      return {
        company: c.company,
        count: clean.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        median: median(clean),
        domain,
        logo: domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null,
        topRole: Object.entries(c.roles).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
      };
    })
    .sort((a, b) => b.count - a.count);

  // Compute topPct
  const sortedByMedian = [...result].sort((a, b) => b.median - a.median);
  const enriched = result.map(c => {
    const rank = sortedByMedian.findIndex(x => x.company === c.company);
    const raw = Math.round(((rank + 1) / result.length) * 100);
    const topPct = Math.max(5, Math.round(raw / 5) * 5);
    return { ...c, topPct };
  });

  res.setHeader('Cache-Control', 's-maxage=600');
  res.status(200).json(enriched);
}
