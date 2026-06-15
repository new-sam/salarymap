// 기존 submissions.company 회사명 분산을 "병합 제안"으로 출력하는 DRY-RUN 스크립트.
// 아무것도 변경하지 않는다. 검토용 리포트만 찍는다.
//   node scripts/company-merge-dryrun.mjs
//
// 규칙(보수적): 건수 많은 "앵커"에 소수/오타 변형만 흡수시킨다.
//  - 변형 V를 앵커 C에 붙임 조건: count(C) >= max(10, count(V)*5) (C가 충분히 우세)
//    AND (V가 C의 prefix | C가 V의 prefix | 편집거리<=2) AND 같은 앞 3글자(blocking)
//  - 둘 다 충분히 큰 이름(예: FPT vs FPT Software)은 절대 자동 병합하지 않음 → 수동검토 목록으로.
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const get = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim().replace(/^["']|["']$/g, '');
const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY') || get('NEXT_PUBLIC_SUPABASE_ANON_KEY'));

function lev(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 99; // 빠른 컷오프
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[m][n];
}

const norm = (s) => (s || '').trim().toLowerCase();

// 1) 전체 제출 회사명 페이지네이션 집계
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
console.log(`총 제출: ${rows.length} | 고유 회사명(대소문자 무시 후): ${keys.length}`);

// 2) 앵커(우세 이름)에 변형 흡수 — 작은 것부터 큰 앵커에 붙인다
const anchors = keys.slice(); // 큰 것부터
const mergedInto = {}; // variantKey -> anchorKey
for (let i = keys.length - 1; i >= 0; i--) {
  const v = keys[i];
  if (mergedInto[v]) continue;
  const cv = counts[v];
  let best = null;
  for (const c of anchors) {
    if (c === v || mergedInto[c]) continue;
    const cc = counts[c];
    if (cc < Math.max(10, cv * 5)) continue;        // 앵커가 충분히 우세해야
    if (c.length < 4) continue;                     // 너무 짧은 앵커(fpt/vin)는 오타 흡수 위험 → 제외
    if (c.slice(0, 3) !== v.slice(0, 3)) continue;  // blocking
    // 고신뢰 매칭만:
    //  (1) 중간잘림: V가 C의 prefix이고, 잘린 지점이 단어 중간(다음 글자가 공백 아님)
    //      → 'fpt softwar'⊂'fpt software'(o) / 'fpt'⊂'fpt ai'는 prefix 아님(반대방향이라 제외)
    //  (2) 한 글자 오타: 길이차 ≤1, 편집거리 1 ('grap'→'grab', 'shoppee'→'shopee')
    //  단어가 통째로 더 붙은 경우(FPT+' AI', Vin+'amilk')는 절대 안 합침.
    const midwordTrunc = c.startsWith(v) && c.length > v.length && c[v.length] !== ' ';
    const typo1 = Math.abs(c.length - v.length) <= 1 && lev(v, c) <= 1
      && !c.startsWith(v + ' ') && !v.startsWith(c + ' ');
    if (!midwordTrunc && !typo1) continue;
    if (!best || cc > counts[best]) best = c;
  }
  // 모호한 prefix 제외: v가 여러 우세 앵커의 중간잘림 prefix면(예: 'vnp'→VNPAY/VNPT) 합치지 않음
  if (best) {
    const ambig = keys.filter(c => c !== v && counts[c] >= 10 && c.startsWith(v) && c.length > v.length && c[v.length] !== ' ').length;
    if (ambig >= 2) best = null;
  }
  if (best) mergedInto[v] = best;
}

// 3) 그룹 구성
const groups = {};
for (const k of keys) {
  const anchor = mergedInto[k] || k;
  (groups[anchor] || (groups[anchor] = { canonical: display(anchor), anchorCount: counts[anchor], variants: [] }));
  if (k !== anchor) groups[anchor].variants.push({ name: display(k), key: k, count: counts[k] });
}

const withMerges = Object.values(groups).filter(g => g.variants.length > 0)
  .sort((a, b) => (b.variants.reduce((s, v) => s + v.count, 0)) - (a.variants.reduce((s, v) => s + v.count, 0)));

let movedRows = 0, removedNames = 0;
for (const g of withMerges) { movedRows += g.variants.reduce((s, v) => s + v.count, 0); removedNames += g.variants.length; }

console.log(`\n=== 병합 제안: ${withMerges.length}개 그룹, 변형 ${removedNames}개 → 캐넌으로, 제출 ${movedRows}건 이동 ===\n`);
for (const g of withMerges.slice(0, 60)) {
  console.log(`● ${g.canonical} (${g.anchorCount})  ← ${g.variants.map(v => `${v.name}(${v.count})`).join(', ')}`);
}

// 4) 수동검토 후보: 같은 앞단어를 공유하지만 둘 다 우세해서 자동병합 안 한 쌍
console.log(`\n=== 수동검토(둘 다 우세, 자동병합 안 함) ===`);
const big = keys.filter(k => counts[k] >= 10 && !mergedInto[k]);
const seen = new Set();
let pairCount = 0;
for (let i = 0; i < big.length && pairCount < 40; i++) {
  for (let j = i + 1; j < big.length; j++) {
    const a = big[i], b = big[j];
    const w1 = a.split(/\s+/)[0], w2 = b.split(/\s+/)[0];
    if (w1.length >= 3 && w1 === w2) {
      const id = a + '|' + b;
      if (seen.has(id)) continue; seen.add(id);
      console.log(`? ${display(a)}(${counts[a]})  ~  ${display(b)}(${counts[b]})`);
      pairCount++;
      if (pairCount >= 40) break;
    }
  }
}
