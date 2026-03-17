import supabase from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { role, experience, salary, company, source } = req.body;

  if (!role || !experience || !salary) {
    return res.status(400).json({ error: 'role, experience, salary는 필수입니다.' });
  }

  const { data, error } = await supabase
    .from('submissions')
    .insert([{ role, experience, salary, company, source }]);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json({ success: true, data });
}
