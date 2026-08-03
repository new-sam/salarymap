/* VietnamWorks 크롤 공고 description 백필.
   검색 API 요약본("..." 끝)으로 저장된 상세를 공고 페이지 전문으로 교체한다.
   되돌릴 수 있게 기존 description 을 scripts/vw-desc-backup-<ts>.json 에 남긴다.
   사용: node scripts/backfill-vw-descriptions.mjs [--apply] [--limit=N]   (기본은 dry-run) */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const { fetchVwFullTexts, buildDescription } = await import('../lib/vietnamworksDetail.js');

const apply = process.argv.includes('--apply');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ⚠️ supabase 기본 1000행 캡 — 페이지네이션 필수
const jobs = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from('jobs')
    .select('id, title, apply_url, description')
    .eq('source', 'vietnamworks')
    .eq('is_active', true)
    .order('id')
    .range(from, from + 999);
  if (error) throw error;
  jobs.push(...(data || []));
  if (!data || data.length < 1000) break;
}
console.log(`활성 VW 공고 ${jobs.length}건${limit < Infinity ? ` (limit ${limit})` : ''}`);

const updates = [];
let noUrl = 0, fetchFail = 0, notLonger = 0, mismatch = 0;
const norm = s => (s || '').replace(/\s+/g, ' ').trim();

for (const [i, job] of jobs.entries()) {
  if (updates.length >= limit) break;
  if (!job.apply_url) { noUrl++; continue; }
  const full = await fetchVwFullTexts(job.apply_url);
  await sleep(300);
  if (!full) { fetchFail++; continue; }
  const next = buildDescription(full.description, full.requirement);
  if (next.length <= (job.description || '').length) { notLonger++; continue; }
  // 만료 리다이렉트 등으로 다른 공고 본문을 집어오지 않았는지: 기존 요약본의 앞부분이
  // 전문에 그대로 있어야 같은 공고다.
  const oldHead = norm(job.description).slice(0, 20);
  if (oldHead && !norm(next).includes(oldHead)) {
    mismatch++;
    console.log(`  [mismatch] ${job.id} ${job.title?.slice(0, 40)}`);
    continue;
  }
  updates.push({ id: job.id, old: job.description, next });
  if ((i + 1) % 25 === 0) console.log(`  ...${i + 1}/${jobs.length} 확인, 교체 대상 ${updates.length}`);
}

console.log(`교체 ${updates.length} | url없음 ${noUrl} | fetch실패 ${fetchFail} | 전문이 더 짧음 ${notLonger} | 본문 불일치 ${mismatch}`);
if (updates.length) {
  const s = updates[0];
  console.log(`샘플: ${s.id} — ${s.old?.length ?? 0}자 → ${s.next.length}자`);
}

if (!apply) {
  console.log('dry-run (적용하려면 --apply)');
  process.exit(0);
}

const backupPath = `scripts/vw-desc-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
fs.writeFileSync(backupPath, JSON.stringify(updates.map(u => ({ id: u.id, description: u.old })), null, 2));
console.log(`백업: ${backupPath}`);

let ok = 0, fail = 0;
for (const u of updates) {
  const { error } = await db.from('jobs').update({ description: u.next }).eq('id', u.id);
  if (error) { fail++; console.error(`  실패 ${u.id}: ${error.message}`); }
  else ok++;
}
console.log(`업데이트 완료 ${ok}건, 실패 ${fail}건`);
