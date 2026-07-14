import { verifyAdminOrDevStub } from './check'
import { computeExperimentMetrics } from '../../../lib/experimentMetrics'

// "목표지표 - Sean" 실험 탭 데이터 — 집계 로직은 lib/experimentMetrics.js 공유(롤백 알림 크론과 동일 판정).
const GOAL_PASSWORD = process.env.GOAL_METRICS_PASSWORD || 'wsj11029'

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })
  if ((req.headers['x-goal-pass'] || '') !== GOAL_PASSWORD) {
    return res.status(403).json({ error: 'bad_pass' })
  }

  try {
    const data = await computeExperimentMetrics()
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json(data)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
