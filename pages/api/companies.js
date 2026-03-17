import supabase from '../../lib/supabase';

export default async function handler(req, res) {
  const { data, error } = await supabase
    .from('companies')
    .select('name, tier')
    .order('tier', { ascending: true })
    .order('name', { ascending: true })
    .limit(600);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}
