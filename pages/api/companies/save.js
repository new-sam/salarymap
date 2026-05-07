import supabase from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { name, domain } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const { error } = await supabase
    .from('companies')
    .upsert({ name }, { onConflict: 'name', ignoreDuplicates: true });

  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ ok: true });
}
