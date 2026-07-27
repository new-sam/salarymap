// FYI 의 KTC 공고에 JD 원장 공고코드를 jobs.source_id 로 백필.
// 로직은 lib/ktcCandidatesSync.js 의 syncKtcJobCodes 공유 (ktc-sync 크론이 매일 재실행).
//   node scripts/backfill-ktc-job-codes.mjs           (드라이런 — 변경 없이 매핑만 출력)
//   node scripts/backfill-ktc-job-codes.mjs --apply   (실제 반영)
import { readFileSync } from 'node:fs';

// lib 이 모듈 로드 시 process.env 를 읽으므로 먼저 .env.local 주입
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.trim().startsWith('#')) {
    const k = line.slice(0, i).trim();
    if (!(k in process.env)) process.env[k] = line.slice(i + 1).trim().replace(/^"|"$/g, '');
  }
}

const { syncKtcJobCodes } = await import('../lib/ktcCandidatesSync.js');

const apply = process.argv.includes('--apply');
const r = await syncKtcJobCodes({ dry: !apply });

console.log(`${apply ? '✓ 반영' : '· 드라이런'} — KTC 공고 ${r.total}건 중 기존 코드 ${r.alreadySet} · 신규 매칭 ${r.set} · 모호 ${r.ambiguous.length} · 충돌 ${r.conflicts.length}`);
for (const m of r.mapping) console.log('  ', m);
if (r.ambiguous.length) {
  console.log('\n⚠ 매칭 모호 (source_id 미기록 — 원장 제목·회사와 대조해 수동 확인 필요):');
  for (const a of r.ambiguous) console.log(`   ${a.active ? '[모집중]' : '[비활성]'} ${a.company} · ${a.title}`);
}
if (r.conflicts.length) {
  console.log('\n⚠ 기존 source_id 와 매칭 결과 불일치 (덮어쓰지 않음):');
  for (const c of r.conflicts) console.log(`   ${c.company} · ${c.title}: 저장 ${c.saved} vs 매칭 ${c.matched}`);
}
