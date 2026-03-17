import supabase from '../../lib/supabase';

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? Math.round((s[m - 1] + s[m]) / 2) : s[m];
}

export default async function handler(req, res) {
  const { role, experience, salary } = req.query;
  if (!role || !experience || !salary) {
    return res.status(400).json({ error: 'role, experience, salary required' });
  }

  const sal = parseInt(salary);

  const { data } = await supabase
    .from('submissions')
    .select('salary')
    .eq('role', role)
    .eq('experience', experience);

  if (!data || data.length < 5) {
    return res.json({ usedFallback: true });
  }

  const salaries = data.map(s => s.salary).sort((a, b) => a - b);
  const n = salaries.length;
  const below = salaries.filter(s => s < sal).length;
  const percentile = Math.round((below / n) * 100);
  const topPct = Math.max(1, Math.min(99, 100 - percentile));
  const med = median(salaries);
  const p25 = salaries[Math.floor(n * 0.25)];
  const p75 = salaries[Math.floor(n * 0.75)];

  return res.json({ topPct, median: med, p25, p75, usedFallback: false, n });
}
