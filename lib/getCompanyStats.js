import supabase from './supabase';

const VALID_ROLES = ['Backend','Frontend','Fullstack','Mobile','Data Engineer','DevOps / Cloud','UI/UX','PM','Marketer'];
const VALID_EXP   = ['Under 1 year','1–2 yrs','3–4 yrs','5–7 yrs','8+ yrs'];
const MIN_SUBS    = 5;  // minimum submissions to show a company
const SALARY_MIN  = 5;
const SALARY_MAX  = 300;

function isJunk(company) {
  if (!company || company.length < 2 || company.length > 80) return true;
  // Korean (Hangul), CJK, Katakana, Hiragana
  if (/[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F\u4E00-\u9FFF\u3040-\u30FF]/.test(company)) return true;
  // All non-latin/non-Vietnamese chars (basically gibberish like "fgf", "테스트")
  if (company.replace(/[a-zA-ZÀ-ỹ0-9\s\.\-&,''()\/]/g, '').length > company.length * 0.4) return true;
  return false;
}

function calcMedian(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? Math.round((s[m - 1] + s[m]) / 2) : s[m];
}

export async function getCompanyStats() {
  const { data, error } = await supabase
    .from('submissions')
    .select('role, experience, salary, company');

  if (error || !data) return [];

  // Clean data
  const clean = data.filter(s =>
    s.salary >= SALARY_MIN &&
    s.salary <= SALARY_MAX &&
    VALID_ROLES.includes(s.role) &&
    VALID_EXP.includes(s.experience) &&
    !isJunk(s.company)
  );

  // Group by company (trim whitespace)
  const byCompany = {};
  clean.forEach(s => {
    const key = s.company.trim();
    if (!byCompany[key]) byCompany[key] = [];
    byCompany[key].push(s);
  });

  // Aggregate
  const stats = Object.entries(byCompany)
    .filter(([, subs]) => subs.length >= MIN_SUBS)
    .map(([company, subs]) => {
      const salaries = subs.map(s => s.salary).sort((a, b) => a - b);
      const n = salaries.length;
      const median = calcMedian(salaries);
      const salMin  = salaries[Math.max(0, Math.floor(n * 0.1))];
      const salMax  = salaries[Math.min(n - 1, Math.floor(n * 0.9))];

      // Per-role aggregation
      const byRole = {};
      subs.forEach(s => {
        if (!byRole[s.role]) byRole[s.role] = [];
        byRole[s.role].push(s.salary);
      });
      const salaryByRole = Object.entries(byRole)
        .filter(([, ss]) => ss.length >= 2)
        .map(([role, ss]) => ({ role, median: calcMedian(ss), count: ss.length }))
        .sort((a, b) => b.median - a.median)
        .slice(0, 5);

      return { company, count: n, median, salMin, salMax, salaryByRole };
    })
    .sort((a, b) => b.count - a.count);

  // Compute topPct: salary rank among all companies (higher median = lower % = better)
  const sortedByMedian = [...stats].sort((a, b) => b.median - a.median);
  return stats.map(s => {
    const rank = sortedByMedian.findIndex(x => x.company === s.company); // 0-indexed
    const raw = Math.round(((rank + 1) / stats.length) * 100);
    const topPct = Math.max(5, Math.round(raw / 5) * 5); // round to nearest 5, min 5
    return { ...s, topPct };
  });
}
