import supabase from '../../lib/supabaseAdmin';

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? Math.round((s[m - 1] + s[m]) / 2) : s[m];
}

export default async function handler(req, res) {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: 'name required' });

  // 1. 해당 회사 제출 데이터
  const { data: subs } = await supabase
    .from('submissions')
    .select('role, experience, salary')
    .ilike('company', name);

  if (subs && subs.length >= 3) {
    const byRole = {};
    for (const s of subs) {
      if (!byRole[s.role]) byRole[s.role] = [];
      byRole[s.role].push(s.salary);
    }
    const stats = Object.entries(byRole)
      .map(([role, salaries]) => ({
        role,
        median: median(salaries),
        min: Math.min(...salaries),
        max: Math.max(...salaries),
        count: salaries.length,
      }))
      .sort((a, b) => b.count - a.count);

    return res.json({ found: true, company: name, total: subs.length, stats });
  }

  // 2. 데이터 없음 → 비슷한 회사 찾기 (같은 산업 키워드 매칭)
  const keywords = extractKeywords(name);

  // 데이터 있는 회사 목록
  const { data: allSubs } = await supabase
    .from('submissions')
    .select('company');

  const coWithData = [...new Set((allSubs || []).map(s => s.company))];

  // 키워드 매칭으로 유사 회사 찾기
  let similar = coWithData.filter(co =>
    keywords.some(kw => co.toLowerCase().includes(kw))
  ).slice(0, 6);

  // 키워드 매칭 없으면 랜덤 6개
  if (similar.length < 3) {
    similar = coWithData.sort(() => 0.5 - Math.random()).slice(0, 6);
  }

  return res.json({ found: false, company: name, similar });
}

function extractKeywords(name) {
  const lower = name.toLowerCase();
  const industryMap = {
    bank: ['bank', 'finance', 'credit', 'capital', 'securities', 'invest'],
    tech: ['tech', 'software', 'digital', 'it', 'cloud', 'ai', 'data'],
    ecom: ['commerce', 'shop', 'mart', 'store', 'retail', 'lazada', 'tiki'],
    log:  ['express', 'logistics', 'delivery', 'transport', 'shipping'],
    game: ['game', 'gaming', 'studio', 'play'],
    edu:  ['edu', 'school', 'learn', 'academy', 'english'],
  };
  for (const [, kws] of Object.entries(industryMap)) {
    if (kws.some(kw => lower.includes(kw))) return kws;
  }
  return lower.split(/\s+/).filter(w => w.length > 2);
}
