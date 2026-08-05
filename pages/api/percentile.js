import supabase from '../../lib/supabaseAdmin';
import { excludeSuspicious } from '../../lib/salaryQuality';
import { inSalaryRange } from '../../lib/salaryStats';
import { submitRolePool } from '../../constants/jobs';
import { seedTopCompanies } from '../../lib/seedCompanies';

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

  // Fetch submissions for this role + experience — 대분류 풀(legacy 포함)을 한 번에 조회,
  // 소분류 표본이 5건 이상이면 소분류끼리, 아니면 대분류 합산으로 비교.
  // 슬라이더 기본값(62) 미입력 통과 의심값은 공개 통계에서 제외
  const pool = submitRolePool(role);
  const poolRows = excludeSuspicious(await fetchAll(
    supabase.from('submissions').select('role, salary, company, created_at').in('role', pool).eq('experience', experience)
  ), experience).filter(r => inSalaryRange(r.salary));
  const exactRows = poolRows.filter(r => r.role === role);
  const data = exactRows.length >= 5 ? exactRows : poolRows;

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
  // (연차 무관 — 회사 단위 비교라 대분류 풀 기준)
  const allRoleSubs = excludeSuspicious(await fetchAll(
    supabase.from('submissions').select('company, salary, experience, created_at').in('role', pool)
  ));

  const byCoAll = {};
  (allRoleSubs || []).forEach(row => {
    const co = (row.company || '').trim();
    if (!co || !inSalaryRange(row.salary)) return;
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
