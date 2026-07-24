// KTC 데이터 일일 자동 동기화 — 어드민 "동기화" 버튼(admin/ktc-sources-sync)과 동일한
// 파이프라인을 Vercel cron이 매일 실행해, 지원 건(ktc_applications)·입사(ktc_hires) 데이터가
// 수동 실행 없이도 최신으로 유지되게 한다 (스태핑 마스터 대시보드가 이 산출물을 읽음).
// Vercel cron이 Authorization: Bearer ${CRON_SECRET} 헤더로 호출 (daily-hot-post.js와 동일).
// vercel.json crons: { "path": "/api/cron/ktc-sync", "schedule": "30 22 * * *" }  (22:30 UTC = 07:30 KST)
import { triggerSheetSync, syncKtcCandidates, syncKtcApplications, syncKtcHires, pushFyiToKtc } from '../../../lib/ktcCandidatesSync'

export const config = { maxDuration: 300 }

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

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
      // 입사자(ktc_hires)는 실패해도 나머지는 유지
      try { hires = await syncKtcHires() } catch (e) { console.error('syncKtcHires:', e.message) }
    }
    res.json({ ok: true, ...stats, applications: apps ? apps.total : null, hires: hires ? hires.total : null, fyiPushed: push.pushed })
  } catch (e) {
    console.error('cron ktc-sync:', e)
    res.status(500).json({ error: e.message })
  }
}
