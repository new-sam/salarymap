// 대소문자만 다른 회사명 변형을 "가장 흔한 표기"로 통일한다(같은 소문자 키 = 100% 같은 회사).
// 백업 후 적용.   node scripts/company-casefold-apply.mjs
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const get = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim().replace(/^["']|["']$/g, '');
const SERVICE = get('SUPABASE_SERVICE_ROLE_KEY');
if (!SERVICE) { console.error('SUPABASE_SERVICE_ROLE_KEY 필요.'); process.exit(1); }
const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), SERVICE);

let rows = [];
for (let f = 0; ; f += 1000) {
  const { data, error } = await sb.from('submissions').select('company').range(f, f + 999);
  if (error) { console.error('ERR', error.message); process.exit(1); }
  if (!data || data.length === 0) break;
  rows = rows.concat(data);
  if (data.length < 1000) break;
}
const casing = {};
for (const r of rows) {
  const o = (r.company || '').trim();
  if (!o) continue;
  const k = o.toLowerCase();
  (casing[k] || (casing[k] = {}))[o] = (casing[k][o] || 0) + 1;
}

// 통일 계획: 키별 dominant 표기로, 나머지 표기를 매핑
const oldToNew = {}; // oldCasing -> dominant
for (const k in casing) {
  const cs = Object.entries(casing[k]);
  if (cs.length < 2) continue;
  const dom = cs.sort((a, b) => b[1] - a[1])[0][0];
  for (const [name] of cs) if (name !== dom) oldToNew[name] = dom;
}
const oldNames = Object.keys(oldToNew);
console.log(`통일 대상 표기 ${oldNames.length}개`);

// 백업
let affected = [];
for (let i = 0; i < oldNames.length; i += 50) {
  const { data, error } = await sb.from('submissions').select('id, company').in('company', oldNames.slice(i, i + 50));
  if (error) { console.error('백업 실패', error.message); process.exit(1); }
  affected = affected.concat(data || []);
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = `scripts/company-casefold-backup-${stamp}.json`;
fs.writeFileSync(backupPath, JSON.stringify(affected, null, 2));
console.log(`백업 ${affected.length}행 → ${backupPath}`);

let updated = 0;
for (const old of oldNames) {
  const { data, error } = await sb.from('submissions').update({ company: oldToNew[old] }).eq('company', old).select('id');
  if (error) { console.error(`'${old}'→'${oldToNew[old]}' 실패:`, error.message); continue; }
  updated += (data || []).length;
}
console.log(`완료: ${updated}행 통일됨.`);
