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

// 연차 데이터가 "1–2 yrs" / "1" / "3–4 yrs" 등으로 지저분해, 첫 정수를 뽑아
// 정렬된 버킷으로 정규화한다. 회사 페이지의 연차별 그래프 x축이 된다.
const EXP_BUCKETS = [
  { label: '0–2', test: n => n <= 2 },
  { label: '3–5', test: n => n >= 3 && n <= 5 },
  { label: '6–8', test: n => n >= 6 && n <= 8 },
  { label: '9+', test: n => n >= 9 },
];
function expBucket(exp) {
  if (exp == null) return null;
  const m = String(exp).match(/\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return (EXP_BUCKETS.find(b => b.test(n)) || null)?.label || null;
}
// 버킷별 살라리 맵 -> 순서 유지한 [{bucket, median, count}] (데이터 있는 버킷만)
function buildExpSeries(bucketMap) {
  return EXP_BUCKETS.map(b => {
    const arr = bucketMap[b.label];
    if (!arr || !arr.length) return null;
    const clean = removeOutliers(arr);
    return { bucket: b.label, median: median(clean), count: clean.length };
  }).filter(Boolean);
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

  // 회사 페이지 헤드라인용 전체 중앙값(직무 무관, 이상치 제거 후).
  const allSalaries = data.map(d => d.salary).filter(s => s >= 5 && s <= 200);
  const clean = removeOutliers(allSalaries);
  const overall = clean.length ? median(clean) : null;

  // 연차별 시리즈: 'all'(직군 무관) + 직군별. 클라이언트가 직군 필터로 즉시 전환.
  const allBuckets = {};
  const roleBuckets = {};
  data.forEach(({ role, experience, salary }) => {
    if (!role || salary < 5 || salary > 200) return;
    const b = expBucket(experience);
    if (!b) return;
    (allBuckets[b] = allBuckets[b] || []).push(salary);
    (roleBuckets[role] = roleBuckets[role] || {});
    (roleBuckets[role][b] = roleBuckets[role][b] || []).push(salary);
  });
  const series = { all: buildExpSeries(allBuckets) };
  Object.keys(roleBuckets).forEach(role => {
    series[role] = buildExpSeries(roleBuckets[role]);
  });

  res.setHeader('Cache-Control', 's-maxage=600');
  res.status(200).json({
    company: name,
    total: data.length,
    overall,
    sampleCount: clean.length,
    roles,
    series,
  });
}
