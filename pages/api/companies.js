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

  // Cross-reference with companies table to get domain
  const companyNames = Object.keys(map);
  const { data: companyData } = await supabase
    .from('companies')
    .select('name')
    .in('name', companyNames);

  const result = Object.values(map)
    .filter(c => c.salaries.length >= 3)
    .map(c => {
      const clean = removeOutliers(c.salaries);
      const sorted = [...clean].sort((a, b) => a - b);
      return {
        company: c.company,
        count: clean.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        median: median(clean),
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
