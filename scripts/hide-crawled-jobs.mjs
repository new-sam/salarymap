/* 크롤 소스 공고 일괄 비노출(is_active=false).
   크롤러 cron이 안 돌아 5/13 이후 신규 유입이 없고, 노출 중인 건 대부분 이미 마감됐을 공고라 내린다.
   되돌릴 수 있도록 대상 id를 scripts/hide-crawled-backup-<ts>.json 에 남긴다.
   사용: node scripts/hide-crawled-jobs.mjs [--apply]   (기본은 dry-run) */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const CRAWL_SOURCES = ['topdev', 'greetinghr', 'greenhouse', 'workable', 'wanted'];
const apply = process.argv.includes('--apply');

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: targets, error } = await db
  .from('jobs')
  .select('id, title, company, source, created_at')
  .eq('is_active', true)
  .in('source', CRAWL_SOURCES);
if (error) throw error;

const bySource = {};
for (const j of targets) bySource[j.source] = (bySource[j.source] || 0) + 1;
console.log(`대상 ${targets.length}건`, bySource);

if (!apply) {
  console.log('dry-run (적용하려면 --apply)');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = `scripts/hide-crawled-backup-${stamp}.json`;
fs.writeFileSync(backup, JSON.stringify(targets, null, 2));
console.log('백업:', backup);

const ids = targets.map((j) => j.id);
for (let i = 0; i < ids.length; i += 100) {
  const chunk = ids.slice(i, i + 100);
  const { error: uErr } = await db.from('jobs').update({ is_active: false }).in('id', chunk);
  if (uErr) throw uErr;
  console.log(`  ${Math.min(i + chunk.length, ids.length)}/${ids.length}`);
}

const { data: after } = await db.from('jobs').select('source').eq('is_active', true);
const left = {};
for (const j of after) left[j.source ?? 'NULL'] = (left[j.source ?? 'NULL'] || 0) + 1;
console.log('적용 후 노출 공고', after.length, left);
