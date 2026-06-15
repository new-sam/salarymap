// company-merge-dryrun.mjs 와 "동일한 보수적 규칙"으로 잡힌 안전 병합을 실제 적용한다.
// 적용 전 영향받는 행(id, 기존회사명)을 백업 파일로 남긴다(되돌리기용).
//   node scripts/company-merge-apply.mjs
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const get = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim().replace(/^["']|["']$/g, '');
const SERVICE = get('SUPABASE_SERVICE_ROLE_KEY');
if (!SERVICE) { console.error('SUPABASE_SERVICE_ROLE_KEY 필요(쓰기 작업).'); process.exit(1); }
const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), SERVICE);

function lev(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 99;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[m][n];
}
const norm = (s) => (s || '').trim().toLowerCase();

let rows = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from('submissions').select('company').range(from, from + 999);
  if (error) { console.error('ERR', error.message); process.exit(1); }
  if (!data || data.length === 0) break;
  rows = rows.concat(data);
  if (data.length < 1000) break;
}
const counts = {}, casing = {};
for (const r of rows) {
  const orig = (r.company || '').trim();
  if (!orig) continue;
  const key = norm(orig);
  counts[key] = (counts[key] || 0) + 1;
  (casing[key] || (casing[key] = {}))[orig] = (casing[key][orig] || 0) + 1;
}
const display = (key) => Object.entries(casing[key]).sort((a, b) => b[1] - a[1])[0][0];
const keys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

const mergedInto = {};
for (let i = keys.length - 1; i >= 0; i--) {
  const v = keys[i];
  if (mergedInto[v]) continue;
  const cv = counts[v];
  let best = null;
  for (const c of keys) {
    if (c === v || mergedInto[c]) continue;
    const cc = counts[c];
    if (cc < Math.max(10, cv * 5)) continue;
    if (c.length < 4) continue;
    if (c.slice(0, 3) !== v.slice(0, 3)) continue;
    const midwordTrunc = c.startsWith(v) && c.length > v.length && c[v.length] !== ' ';
    const typo1 = Math.abs(c.length - v.length) <= 1 && lev(v, c) <= 1
      && !c.startsWith(v + ' ') && !v.startsWith(c + ' ');
    if (!midwordTrunc && !typo1) continue;
    if (!best || cc > counts[best]) best = c;
  }
  if (best) {
    const ambig = keys.filter(c => c !== v && counts[c] >= 10 && c.startsWith(v) && c.length > v.length && c[v.length] !== ' ').length;
    if (ambig >= 2) best = null;
  }
  if (best) mergedInto[v] = best;
}

// 변형 → 캐넌 표기, + 변형의 모든 원본 표기 목록
const plan = Object.keys(mergedInto).map(vKey => ({
  canonical: display(mergedInto[vKey]),
  origCasings: Object.keys(casing[vKey]),
}));
const allOldCasings = [...new Set(plan.flatMap(p => p.origCasings))];
console.log(`병합 대상 변형 ${plan.length}개, 원본 표기 ${allOldCasings.length}개`);

// 백업: 영향받는 모든 행(id, company) 저장
let affected = [];
for (let i = 0; i < allOldCasings.length; i += 50) {
  const chunk = allOldCasings.slice(i, i + 50);
  const { data, error } = await sb.from('submissions').select('id, company').in('company', chunk);
  if (error) { console.error('백업 조회 실패', error.message); process.exit(1); }
  affected = affected.concat(data || []);
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = `scripts/company-merge-backup-${stamp}.json`;
fs.writeFileSync(backupPath, JSON.stringify(affected, null, 2));
console.log(`백업 ${affected.length}행 → ${backupPath}`);

// 적용: 원본 표기별로 캐넌으로 업데이트
let updated = 0;
for (const p of plan) {
  for (const old of p.origCasings) {
    if (old === p.canonical) continue;
    const { data, error } = await sb.from('submissions').update({ company: p.canonical }).eq('company', old).select('id');
    if (error) { console.error(`업데이트 실패 '${old}'→'${p.canonical}':`, error.message); continue; }
    updated += (data || []).length;
  }
}
console.log(`완료: ${updated}행 업데이트됨.`);
