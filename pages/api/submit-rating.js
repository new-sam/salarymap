import supabase from '../../lib/supabase'
import { verifyClaim } from '../../lib/verifyClaim'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { submissionId, claimToken, rating_worklife, rating_salary, rating_growth } = req.body

  if (!submissionId) {
    return res.status(400).json({ error: 'submissionId required' })
  }

  const claim = await verifyClaim(submissionId, claimToken)
  if (!claim.ok) {
    return res.status(403).json({ error: 'Invalid claim token' })
  }

  const { error } = await supabase
    .from('submissions')
    .update({ rating_worklife, rating_salary, rating_growth })
    .eq('id', submissionId)

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  return res.status(200).json({ success: true })
}
