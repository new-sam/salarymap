import supabase from '../../lib/supabaseAdmin';

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? Math.round((s[m - 1] + s[m]) / 2) : s[m];
}

function removeOutliers(salaries) {
  if (salaries.length < 4) return salaries;
  const sorted = [...salaries].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  return sorted.filter(s => s >= lower && s <= upper);
}

// Base medians (triệu VND/mo) per role × experience index [<1yr, 1-2, 3-4, 5-7, 8+]
const BASE_MEDIANS = {
  'Backend':   [25, 40, 75, 110, 140],
  'Frontend':  [22, 36, 68, 100, 130],
  'Mobile':    [24, 38, 72, 105, 135],
  'Data · AI': [28, 45, 80, 115, 145],
  'DevOps':    [26, 42, 78, 112, 138],
  'PM · PO':   [22, 35, 65,  95, 125],
  'Design':    [20, 32, 60,  88, 115],
  'QA':        [18, 28, 50,  72,  95],
};
const EXP_IDX = ['Under 1yr', '1–2 yrs', '3–4 yrs', '5–7 yrs', '8+ yrs'];
const SEED_COMPANIES = [
  { name: 'Grab Vietnam',    domain: 'grab.com',            mult: 1.28 },
  { name: 'Sky Mavis',       domain: 'skymavis.com',        mult: 1.35 },
  { name: 'VNG Corporation', domain: 'vng.com.vn',          mult: 1.18 },
  { name: 'Shopee Vietnam',  domain: 'shopee.vn',           mult: 1.12 },
  { name: 'Momo',            domain: 'momo.vn',             mult: 1.10 },
  { name: 'KMS Technology',  domain: 'kms-technology.com',  mult: 1.06 },
];

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
  'axon active': 'axonactive.com',
  'harvey nash': 'harveynash.vn',
  'katalon': 'katalon.com',
  'got it': 'got-it.ai',
  'teko vietnam': 'teko.vn',
};

function buildTopCompanies(realCompanies, userSalary, userCompany) {
  // Filter out user's company, require premiumPct > 0, sort desc, take top 3
  const candidates = realCompanies
    .filter(c => c.name.toLowerCase() !== (userCompany || '').toLowerCase())
    .map(c => ({
      name: c.name,
      domain: c.domain || '',
      median: c.median,
      premiumPct: Math.round((c.median - userSalary) / userSalary * 100),
    }))
    .filter(c => c.premiumPct > 0)
    .sort((a, b) => b.median - a.median)
    .slice(0, 3);
  return candidates;
}

function seedTopCompanies(role, experience, userSalary, userCompany) {
  const baseArr = BASE_MEDIANS[role] || BASE_MEDIANS['Backend'];
  const expI = EXP_IDX.indexOf(experience);
  const base = baseArr[expI >= 0 ? expI : 2];
  const real = SEED_COMPANIES.map(c => ({
    name: c.name,
    domain: c.domain,
    median: Math.round(base * c.mult),
  }));
  const top = buildTopCompanies(real, userSalary, userCompany);
  // Guarantee 2-3 items: if user's company knocked out too many, add back some
  if (top.length < 2) {
    const extras = real
      .filter(c => !top.find(t => t.name === c.name))
      .sort((a, b) => b.median - a.median)
      .slice(0, 3 - top.length)
      .map(c => ({
        ...c,
        premiumPct: Math.max(1, Math.round((c.median - userSalary) / userSalary * 100)),
      }));
    top.push(...extras);
  }
  return top.slice(0, 3);
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
  const { role, experience, salary, company } = req.query;
  if (!role || !experience || !salary) {
    return res.status(400).json({ error: 'role, experience, salary required' });
  }

  const sal = parseInt(salary);

  // Fetch all submissions for this role + experience (including company)
  const data = await fetchAll(
    supabase.from('submissions').select('salary, company').eq('role', role).eq('experience', experience)
  );

  if (!data || data.length < 5) {
    const topCompanies = seedTopCompanies(role, experience, sal, company || '');
    return res.json({ usedFallback: true, topCompanies, companiesPayingMore: [] });
  }

  // Percentile calc (with outlier removal)
  const salaries = removeOutliers(data.map(s => s.salary));
  const n = salaries.length;
  const below = salaries.filter(s => s < sal).length;
  const percentile = Math.round((below / n) * 100);
  const topPct = Math.max(1, Math.min(99, 100 - percentile));
  const med = median(salaries);
  const p25 = salaries[Math.floor(n * 0.25)];
  const p75 = salaries[Math.floor(n * 0.75)];

  // Group by company, compute median per company
  const byCompany = {};
  for (const row of data) {
    const co = (row.company || '').trim();
    if (!co) continue;
    if (!byCompany[co]) byCompany[co] = [];
    byCompany[co].push(row.salary);
  }
  const companyMedians = Object.entries(byCompany)
    .filter(([, sals]) => sals.length >= 1)
    .map(([name, sals]) => ({ name, median: median(removeOutliers(sals)) }));

  let topCompanies = buildTopCompanies(companyMedians, sal, company || '');

  // Fall back to seed if not enough real data
  if (topCompanies.length < 2) {
    topCompanies = seedTopCompanies(role, experience, sal, company || '');
  }

  // Build companiesPayingMore: all companies for this role with median > user salary
  const allRoleSubs = await fetchAll(
    supabase.from('submissions').select('company, salary').eq('role', role)
  );

  const byCoAll = {};
  (allRoleSubs || []).forEach(row => {
    const co = (row.company || '').trim();
    if (!co || row.salary < 5 || row.salary > 200) return;
    if (!byCoAll[co]) byCoAll[co] = [];
    byCoAll[co].push(row.salary);
  });

  const companiesPayingMore = Object.entries(byCoAll)
    .filter(([name, sals]) => sals.length >= 2 && name.toLowerCase() !== (company || '').toLowerCase())
    .map(([name, sals]) => {
      const clean = removeOutliers(sals);
      const med = median(clean);
      const domain = DOMAIN_MAP[name.toLowerCase()] || '';
      return { company: name, domain, medianSalary: med };
    })
    .filter(c => c.medianSalary > sal)
    .sort((a, b) => b.medianSalary - a.medianSalary)
    .slice(0, 4);

  return res.json({
    topPct,
    percentile: topPct,
    median: med,
    p25,
    p75,
    usedFallback: false,
    n,
    topCompanies,
    userSalary: sal,
    marketMedian: med,
    difference: sal - med,
    role,
    experience,
    companiesPayingMore,
  });
}
