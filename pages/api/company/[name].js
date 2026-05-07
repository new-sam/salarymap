import supabase from '../../../lib/supabaseAdmin';

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

export default async function handler(req, res) {
  const { name } = req.query;

  const { data, error } = await supabase
    .from('submissions')
    .select('role, experience, salary')
    .ilike('company', name);

  if (error) return res.status(500).json({ error: error.message });

  const byRole = {};
  data.forEach(({ role, experience, salary }) => {
    if (!role || salary < 5 || salary > 200) return;
    if (!byRole[role]) byRole[role] = { role, salaries: [], experiences: {} };
    byRole[role].salaries.push(salary);
    byRole[role].experiences[experience] = (byRole[role].experiences[experience] || 0) + 1;
  });

  const roles = Object.values(byRole).map(r => {
    const clean = removeOutliers(r.salaries);
    const sorted = [...clean].sort((a, b) => a - b);
    return {
      role: r.role,
      count: clean.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      median: median(clean),
    };
  }).sort((a, b) => b.median - a.median);

  res.setHeader('Cache-Control', 's-maxage=600');
  res.status(200).json({
    company: name,
    total: data.length,
    roles,
  });
}
