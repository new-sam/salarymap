import supabase from '../../../lib/supabaseAdmin';

// 연봉 제출 폼의 회사명 자동완성.
// 과거엔 companies 테이블(대소문자/오타 변형 수십 건)을 알파벳순으로 보여줘서
// 사용자가 'fpt softwar' 같은 변형을 또 만들었다. 이제 실제 제출 건수로 캐넌 회사를
// 상위 노출 → 사람들이 표준 표기를 고르게 해서 분산을 막는다. 신규 회사는 Clearbit/직접입력.
export default async function handler(req, res) {
  const { q } = req.query;
  if (!q || q.trim().length < 1) return res.status(200).json([]);

  const query = q.trim();

  const [subRes, cbResult] = await Promise.allSettled([
    supabase
      .from('submissions')
      .select('company')
      .ilike('company', `%${query}%`)
      .limit(2000),
    fetch(
      `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(1200) }
    ).then(r => r.json()),
  ]);

  // 제출 데이터를 정규화 키(lower+trim)로 집계 → 건수 + 가장 흔한 표기(캐넌)
  const subRows = subRes.status === 'fulfilled' ? (subRes.value.data || []) : [];
  const counts = {};
  const casing = {};
  for (const r of subRows) {
    const orig = (r.company || '').trim();
    if (!orig) continue;
    const key = orig.toLowerCase();
    counts[key] = (counts[key] || 0) + 1;
    (casing[key] || (casing[key] = {}))[orig] = (casing[key][orig] || 0) + 1;
  }
  const dbResults = Object.entries(counts)
    .filter(([, c]) => c >= 2) // 1건짜리 오타 변형은 제외(신규는 Clearbit/직접입력으로 추가)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([key, count]) => ({
      id: null,
      name: Object.entries(casing[key]).sort((a, b) => b[1] - a[1])[0][0],
      domain: null,
      logo: null,
      source: 'db',
      count,
    }));

  const dbNames = new Set(dbResults.map(c => c.name.toLowerCase()));
  const clearbitResults = (cbResult.status === 'fulfilled' ? cbResult.value : [])
    .slice(0, 6)
    .map(c => ({
      id: null,
      name: c.name,
      domain: c.domain,
      logo: c.domain ? `https://www.google.com/s2/favicons?domain=${c.domain}&sz=64` : null,
      source: 'clearbit',
    }))
    .filter(c => !dbNames.has(c.name.toLowerCase()));

  res.status(200).json([...dbResults, ...clearbitResults].slice(0, 8));
}
