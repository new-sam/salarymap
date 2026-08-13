// KTC 데이터 일일 자동 동기화 — 어드민 "동기화" 버튼(admin/ktc-sources-sync)과 동일한
// 파이프라인을 Vercel cron이 매일 실행해, 지원 건(ktc_applications)·입사(ktc_hires) 데이터가
// 수동 실행 없이도 최신으로 유지되게 한다 (스태핑 마스터 대시보드가 이 산출물을 읽음).
// Vercel cron이 Authorization: Bearer ${CRON_SECRET} 헤더로 호출 (daily-hot-post.js와 동일).
// vercel.json crons: 하루 2회 — "30 22 * * *"(07:30 KST) + "0 6 * * *"(15:00 KST, 베트남팀 요청 2026-08-10)
import { triggerSheetSync, syncKtcCandidates, syncKtcApplications, syncKtcHires, pushFyiToKtc, appendFyiToSheet, syncKtcJobCodes, syncFyiRejections } from '../../../lib/ktcCandidatesSync'

export const config = { maxDuration: 300 }

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    // FYI 지원 건을 ktc-support 파이프라인에 직접 유입 + Candidate Data 시트 FYI 탭 보충
    // (시트 append 는 기록 보존용 보강 레이어 — 실패해도 파이프라인은 계속)
    const push = await pushFyiToKtc()
    let fyiSheet = null
    if (process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
      try { fyiSheet = await appendFyiToSheet() } catch (e) { console.error('appendFyiToSheet:', e.message) }
    }
    const sheet = await triggerSheetSync()
    if (sheet?.type === 'error') {
      return res.status(502).json({ error: `시트 동기화 실패: ${sheet.message || 'unknown'}` })
    }
    const stats = await syncKtcCandidates()
    // KTC 스크리닝 탈락을 FYI 지원 건에 반영 (유저 스텝퍼 '서류 불합격' 표시)
    let rejections = null
    try { rejections = await syncFyiRejections() } catch (e) { console.error('syncFyiRejections:', e.message) }
    let apps = null
    let hires = null
    if (process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
      apps = await syncKtcApplications()
      // 입사자(ktc_hires)는 실패해도 나머지는 유지
      try { hires = await syncKtcHires() } catch (e) { console.error('syncKtcHires:', e.message) }
    }
    // FYI 의 KTC 공고에 원장 공고코드(jobs.source_id) 백필 — 새 공고가 게재되면 다음 날 자동 매칭
    let jobCodes = null
    try { jobCodes = await syncKtcJobCodes() } catch (e) { console.error('syncKtcJobCodes:', e.message) }
    res.json({
      ok: true, ...stats,
      applications: apps ? apps.total : null,
      hires: hires ? hires.total : null,
      fyiPushed: push.pushed,
      fyiRejections: rejections ? rejections.updated : null,
      fyiSheetAppended: fyiSheet ? fyiSheet.appended : null,
      jobCodes: jobCodes ? { set: jobCodes.set, ambiguous: jobCodes.ambiguous.length, conflicts: jobCodes.conflicts.length } : null,
    })
  } catch (e) {
    console.error('cron ktc-sync:', e)
    res.status(500).json({ error: e.message })
  }
}
