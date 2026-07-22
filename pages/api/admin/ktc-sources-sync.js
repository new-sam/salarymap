import { verifyAdminOrDevStub } from './check'
import { triggerSheetSync, syncKtcCandidates, syncKtcApplications, syncKtcHires, pushFyiToKtc } from '../../../lib/ktcCandidatesSync'

// KTC 소싱 탭의 "동기화" 버튼 — 클릭 한 번으로 세 단계를 순서대로 실행:
//  ① ktc-support 시트→DB 동기화 트리거 (완료까지 대기)
//  ② ktc-support DB → salarymap ktc_candidates upsert (유니크 지원자)
//  ③ 시트 직접 읽기 → ktc_applications 재적재 (지원 건, 중복 포함 — GOOGLE_* env 필요)
// 시트 동기화가 수 분 걸릴 수 있어 maxDuration 을 넉넉히 잡는다.
export const config = { maxDuration: 300 }

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    // FYI 지원자를 ktc-support 파이프라인에 먼저 유입시킨 뒤 (신규만) 나머지를 당겨온다
    const push = await pushFyiToKtc()
    const sheet = await triggerSheetSync()
    if (sheet?.type === 'error') {
      return res.status(502).json({ error: `시트 동기화 실패: ${sheet.message || 'unknown'}` })
    }
    const stats = await syncKtcCandidates()
    let apps = null
    let hires = null
    if (process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
      apps = await syncKtcApplications()
      // 입사자(ktc_hires)는 마이그레이션 전일 수 있으니 실패해도 나머지는 유지
      try { hires = await syncKtcHires() } catch (e) { console.error('syncKtcHires:', e.message) }
    }
    res.json({ ok: true, sheet, ...stats, applications: apps ? apps.total : null, hires: hires ? hires.total : null, fyiPushed: push.pushed })
  } catch (e) {
    console.error('ktc-sources-sync:', e)
    res.status(500).json({ error: e.message })
  }
}
