import { verifyAdmin } from './check'
import { parseResumeForUser } from '../../../lib/parseResume'

export default async function handler(req, res) {
  const admin = await verifyAdmin(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { userId } = req.body
  if (!userId) return res.status(400).json({ error: 'userId required' })

  try {
    const update = await parseResumeForUser(userId)
    return res.json({ userId, ...update, skills: (update.skills || []).join(', ') })
  } catch (err) {
    console.error('Admin resume parse error:', err)
    return res.status(500).json({ error: err.message || 'Failed to parse resume' })
  }
}
