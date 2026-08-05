import supabase from '../../lib/supabaseAdmin';
import { submitRolePool } from '../../constants/jobs';
import { seedTopCompanies } from '../../lib/seedCompanies';
import { roleMedian } from '../../constants/salaryMedians';

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? Math.round((s[m - 1] + s[m]) / 2) : s[m];
}

// Experience-based salary caps (triệu VND/month)
const SALARY_CAP = {
  'Under 1yr': 40,
  '1–2 yrs': 60,
  '3–4 yrs': 80,
  '5–7 yrs': 120,
  '8+ yrs': 200,
};

function removeOutliers(arr, experience) {
  // Hard cap by experience level
  const cap = SALARY_CAP[experience] || 200;
  let filtered = arr.filter(s => s >= 5 && s <= cap);
  if (filtered.length < 3) filtered = arr.filter(s => s >= 5 && s <= 200);
  // IQR filter
  if (filtered.length < 4) return filtered;
  const sorted = [...filtered].sort((a, b) => a - b);
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
  const { salary, role, experience, company } = req.query;
  const userSalary = parseInt(salary);

  if (!userSalary || !role || !experience) {
    return res.status(400).json({ error: 'salary, role, experience required' });
  }

  // 같은 대분류로 합산되는 role 값 전체(legacy 포함) — 한 번에 조회
  const pool = submitRolePool(role);
  const poolData = await fetchAll(
    supabase.from('submissions').select('role, salary, company, experience').in('role', pool)
  );

  // 캐스케이드: 소분류+연차 → 소분류 전체 → 대분류풀+연차 → 대분류풀 전체.
  // IT처럼 소분류 표본이 충분하면 그대로 소분류 비교, 신규 비개발 소분류는 대분류로 합산.
  const exact = (poolData || []).filter(p => p.role === role);
  let peers = exact.filter(p => p.experience === experience);
  if (peers.length < 3) peers = exact;
  if (peers.length < 3) peers = (poolData || []).filter(p => p.experience === experience);
  if (peers.length < 3) peers = poolData || [];

  if (peers.length < 3) {
    // 표본 부족 — 직군 기준 중위값으로 비교하고 회사 비교는 기준 회사로 채운다
    const seedMedian = roleMedian(role, experience);
    const seedDiff = userSalary - seedMedian;
    return res.status(200).json({
      percentile: Math.max(1, Math.min(99, Math.round(50 - (seedDiff / seedMedian) * 50))),
      userSalary,
      marketMedian: seedMedian,
      diff: seedDiff,
      diffPct: Math.round((seedDiff / seedMedian) * 100),
      topCompanies: seedTopCompanies(role, experience, userSalary, company, 4),
    });
  }

  const clean = removeOutliers(peers.map(p => p.salary), experience);
  const sorted = [...clean].sort((a, b) => a - b);
  const below = sorted.filter(s => s < userSalary).length;
  const rawPct = Math.round((below / sorted.length) * 100);
  const percentile = Math.max(1, Math.min(99, 100 - rawPct));
  const marketMedian = median(clean);
  const diff = userSalary - marketMedian;
  const diffPct = marketMedian > 0 ? Math.round((diff / marketMedian) * 100) : 0;

  // 회사 비교도 같은 코호트 기준 — 소분류 표본이 있으면 소분류, 없으면 대분류 풀
  const companyData = exact.length >= 3 ? exact : poolData;

  const companyMap = {};
  (companyData || []).forEach(row => {
    const co = (row.company || '').trim();
    if (!co || co.length < 2 || row.salary < 5 || row.salary > 200) return;
    if (!companyMap[co]) companyMap[co] = [];
    companyMap[co].push(row.salary);
  });

  const realTopCompanies = Object.entries(companyMap)
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

  // 회사명이 붙은 실제 제출이 부족한 직군(시드로 채운 비개발 등)은 기준 회사로 대체
  const topCompanies = realTopCompanies.length >= 2
    ? realTopCompanies
    : seedTopCompanies(role, experience, userSalary, company, 4);

  res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300');
  res.status(200).json({
    percentile,
    userSalary,
    marketMedian,
    diff,
    diffPct,
    topCompanies,
  });
}
