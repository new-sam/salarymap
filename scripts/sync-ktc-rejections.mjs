// KTC 스크리닝 탈락(rejected·screening_failed) → FYI job_applications 불합격 일괄 반영.
// 로직은 lib/ktcCandidatesSync.js syncFyiRejections 공유 (ktc-sync 크론·어드민 동기화 버튼과 동일).
//   node scripts/sync-ktc-rejections.mjs [--dry]
import { readFileSync } from 'node:fs';

// lib 이 모듈 로드 시 process.env 를 읽으므로 먼저 .env.local 주입
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.trim().startsWith('#')) {
    const k = line.slice(0, i).trim();
    if (!(k in process.env)) process.env[k] = line.slice(i + 1).trim().replace(/^"|"$/g, '');
  }
}

const { syncFyiRejections } = await import('../lib/ktcCandidatesSync.js');

const dry = process.argv.includes('--dry');
const r = await syncFyiRejections({ dry });
console.log(`${dry ? '[dry] ' : ''}KTC 탈락 ${r.ktcRejected}건 → 지원 건 매칭 ${r.matched} → 불합격 반영 ${r.updated} (기반영/후단계 스킵 ${r.alreadyDone})`);
