// ktc-support Supabase candidates → salarymap ktc_candidates 동기화. idempotent (upsert).
// 로직은 lib/ktcCandidatesSync.js 공유 (어드민 KTC 소싱 탭의 동기화 버튼과 동일).
//   node scripts/sync-ktc-candidates.mjs [--sheets]   (--sheets: ktc-support 시트→DB 동기화까지 먼저 실행)
import { readFileSync } from 'node:fs';

// lib 이 모듈 로드 시 process.env 를 읽으므로 먼저 .env.local 주입
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.trim().startsWith('#')) {
    const k = line.slice(0, i).trim();
    if (!(k in process.env)) process.env[k] = line.slice(i + 1).trim().replace(/^"|"$/g, '');
  }
}

const { triggerSheetSync, syncKtcCandidates, syncKtcApplications } = await import('../lib/ktcCandidatesSync.js');

if (process.argv.includes('--sheets')) {
  console.log('• ktc-support 시트 동기화 트리거...');
  const ev = await triggerSheetSync();
  console.log('  →', ev ? JSON.stringify(ev) : '완료(요약 이벤트 없음)');
}

const stats = await syncKtcCandidates();
console.log(`✓ 지원자(유니크) 동기화: fetched ${stats.fetched} → upsert ${stats.upserted} (스킵 ${stats.skipped}) | 날짜 파싱 ${stats.dateParsed} | 공고코드 ${stats.jobCoded}`);

if (process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
  const app = await syncKtcApplications();
  console.log(`✓ 지원 건 동기화: ${app.total}건`, JSON.stringify(app.perTab));
} else {
  console.log('⚠ GOOGLE_* env 없음 — 지원 건(ktc_applications) 동기화 스킵');
}
