import supabase from '../../lib/supabase';
import { verifyClaim } from '../../lib/verifyClaim';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { submissionId, claimToken, intent } = req.body;
  if (!submissionId || !intent) return res.status(400).json({ error: 'submissionId and intent required' });

  const validIntents = ['open', 'selective', 'none', 'maybe_later', 'dismissed'];
  if (!validIntents.includes(intent)) return res.status(400).json({ error: 'Invalid intent' });

  const claim = await verifyClaim(submissionId, claimToken);
  if (!claim.ok) return res.status(403).json({ error: 'Invalid claim token' });

  const { error } = await supabase
    .from('submissions')
    .update({ intent })
    .eq('id', submissionId);

  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ ok: true });
}
