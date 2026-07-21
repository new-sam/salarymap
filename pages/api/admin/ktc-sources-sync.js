import { verifyAdminOrDevStub } from './check'
import { triggerSheetSync, syncKtcCandidates } from '../../../lib/ktcCandidatesSync'

// KTC 소싱 탭의 "동기화" 버튼 — 클릭 한 번으로 두 단계를 순서대로 실행:
//  ① ktc-support 시트→DB 동기화 트리거 (완료까지 대기)
//  ② ktc-support DB → salarymap ktc_candidates upsert
// 시트 동기화가 수 분 걸릴 수 있어 maxDuration 을 넉넉히 잡는다.
export const config = { maxDuration: 300 }

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const sheet = await triggerSheetSync()
    if (sheet?.type === 'error') {
      return res.status(502).json({ error: `시트 동기화 실패: ${sheet.message || 'unknown'}` })
    }
    const stats = await syncKtcCandidates()
    res.json({ ok: true, sheet, ...stats })
  } catch (e) {
    console.error('ktc-sources-sync:', e)
    res.status(500).json({ error: e.message })
  }
}
