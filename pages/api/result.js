import supabase from '../../lib/supabase';

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? Math.round((s[m - 1] + s[m]) / 2) : s[m];
}

function removeOutliers(arr) {
  if (arr.length < 4) return arr;
  const sorted = [...arr].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  return sorted.filter(s => s >= q1 - 1.5 * iqr && s <= q3 + 1.5 * iqr);
}

const DOMAIN_MAP = {
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
  'kms technology': 'kms-technology.com',
  'nashtech': 'nashtechglobal.com',
  'nashtech global': 'nashtechglobal.com',
  'axon active': 'axonactive.com',
  'harvey nash': 'harveynash.vn',
  'katalon': 'katalon.com',
  'got it': 'got-it.ai',
  'teko vietnam': 'teko.vn',
  'shb finance': 'shbfinance.com.vn',
  'onemount group': 'onemount.com',
  'logivan': 'logivan.com',
  'base.vn': 'base.vn',
  'sendo': 'sendo.vn',
  'ghn': 'ghn.vn',
  'rever': 'rever.vn',
  'kiotviet': 'kiotviet.vn',
  'amanotes': 'amanotes.com',
  'mbbank': 'mbbank.com.vn',
  'viettel': 'viettel.com.vn',
  'sacombank digital': 'sacombank.com.vn',
  'fossil group vn': 'fossil.com',
  'trusting social': 'trustingsocial.com',
};

// Map wizard role names to DB role names
const ROLE_MAP = {
  'Data · AI': 'Data Engineer',
  'PM · PO': 'PM',
  'Design': 'Frontend',  // fallback: no Design data, use Frontend
  'QA': 'Backend',        // fallback: no QA data, use Backend
};

function resolveRole(role) {
  return ROLE_MAP[role] || role;
}

// Paginate through all rows (Supabase caps at 1000 per request)
async function fetchAll(query) {
  const PAGE = 1000;
  let all = [], from = 0;
  while (true) {
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export default async function handler(req, res) {
  const { salary, role: rawRole, experience, company } = req.query;
  const userSalary = parseInt(salary);
  const role = resolveRole(rawRole);

  if (!userSalary || !rawRole || !experience) {
    return res.status(400).json({ error: 'salary, role, experience required' });
  }

  // Get peers: same role + same experience, fallback to role only
  let peers = await fetchAll(
    supabase.from('submissions').select('salary').eq('role', role).eq('experience', experience)
  );

  // If not enough peers for exact match, broaden to all experience levels for this role
  if (!peers || peers.length < 3) {
    peers = await fetchAll(
      supabase.from('submissions').select('salary').eq('role', role)
    );
  }

  if (!peers || peers.length < 3) {
    return res.status(200).json({
      percentile: 50,
      userSalary,
      marketMedian: userSalary,
      diff: 0,
      diffPct: 0,
      topCompanies: [],
    });
  }

  const clean = removeOutliers(peers.map(p => p.salary).filter(s => s >= 5 && s <= 200));
  const sorted = [...clean].sort((a, b) => a - b);
  const below = sorted.filter(s => s < userSalary).length;
  const rawPct = Math.round((below / sorted.length) * 100);
  const percentile = Math.max(1, Math.min(99, 100 - rawPct));
  const marketMedian = median(clean);
  const diff = userSalary - marketMedian;
  const diffPct = marketMedian > 0 ? Math.round((diff / marketMedian) * 100) : 0;

  // Get companies paying more for this role
  const companyData = await fetchAll(
    supabase.from('submissions').select('company, salary').eq('role', role)
  );

  const companyMap = {};
  (companyData || []).forEach(row => {
    const co = (row.company || '').trim();
    if (!co || co.length < 2 || row.salary < 5 || row.salary > 200) return;
    if (!companyMap[co]) companyMap[co] = [];
    companyMap[co].push(row.salary);
  });

  const topCompanies = Object.entries(companyMap)
    .filter(([name, sals]) => sals.length >= 2 && name.toLowerCase() !== (company || '').toLowerCase())
    .map(([name, sals]) => {
      const cleanSals = removeOutliers(sals);
      const med = median(cleanSals);
      const premiumPct = Math.round(((med - userSalary) / userSalary) * 100);
      const domain = DOMAIN_MAP[name.toLowerCase()] || '';
      return { name, median: med, premiumPct, domain };
    })
    .filter(co => co.premiumPct > 0)
    .sort((a, b) => b.premiumPct - a.premiumPct)
    .slice(0, 4);

  res.status(200).json({
    percentile,
    userSalary,
    marketMedian,
    diff,
    diffPct,
    topCompanies,
  });
}
