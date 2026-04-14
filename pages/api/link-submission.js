import supabase from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { submission_id, user_id } = req.body;
  if (!submission_id || !user_id) {
    return res.status(400).json({ error: 'submission_id and user_id required' });
  }

  // Only link if submission has no user_id yet (don't overwrite)
  const { error } = await supabase
    .from('submissions')
    .update({ user_id })
    .eq('id', submission_id)
    .is('user_id', null);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true });
}
