import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { jobId, userId, resumeUrl } = req.body
  if (!jobId || !userId) {
    return res.status(400).json({ error: 'jobId and userId required' })
  }

  const { data, error } = await supabase
    .from('job_applications')
    .insert({
      job_id: jobId,
      user_id: userId,
      resume_url: resumeUrl || null,
    })
    .select('id')
    .single()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  console.log(`[JOB APPLICATION] user=${userId} applied to job=${jobId}`)

  return res.status(201).json({ success: true, data })
}
