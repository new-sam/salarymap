import supabase from '../../../lib/supabase';

export default async function handler(req, res) {
  const { q } = req.query;
  if (!q || q.trim().length < 1) return res.status(200).json([]);

  const query = q.trim();

  // Source 1 & 2: run in parallel
  const [dbResult, cbResult] = await Promise.allSettled([
    supabase
      .from('companies')
      .select('id, name')
      .ilike('name', `%${query}%`)
      .order('name')
      .limit(6),
    fetch(
      `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(1200) }
    ).then(r => r.json()),
  ]);

  const dbResults = dbResult.status === 'fulfilled' ? dbResult.value.data : [];
  const clearbitResults = (cbResult.status === 'fulfilled' ? cbResult.value : [])
    .slice(0, 6)
    .map(c => ({
      id: null,
      name: c.name,
      domain: c.domain,
      logo: c.domain ? `https://www.google.com/s2/favicons?domain=${c.domain}&sz=64` : null,
      source: 'clearbit',
    }));

  // Merge: DB results take priority, Clearbit fills the rest
  const dbNames = new Set((dbResults || []).map(c => c.name.toLowerCase()));

  const merged = [
    ...(dbResults || []).map(c => ({
      id: c.id,
      name: c.name,
      domain: null,
      logo: null,
      source: 'db',
    })),
    ...clearbitResults.filter(c => !dbNames.has(c.name.toLowerCase())),
  ].slice(0, 8);

  res.status(200).json(merged);
}
