import supabase from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { submissionId, rating_worklife, rating_salary, rating_growth } = req.body

  if (!submissionId) {
    return res.status(400).json({ error: 'submissionId required' })
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
