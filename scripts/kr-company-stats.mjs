// 한국 법인 공공데이터 수집 → company_kr_stats 캐시 적재.
//   소스: 국민연금 사업장 API(data.go.kr B552015) + DART 오픈API(재무·설립일)
//   매핑: scripts/kr-company-mapping.json (company ↔ kr_name+bzowr_prefix/dart_corp_code, 수동 확정)
//   * 국민연금 V2는 사업장 행이 자료생성년월별(각자 seq)로 온다 — 식별키는 사업장명+사업자 앞자리.
//
// 사용법:
//   node scripts/kr-company-stats.mjs --search "킨도프"      # 국민연금 사업장 검색 (kr_name 확정용)
//   node scripts/kr-company-stats.mjs --search-all           # 매핑에서 seq 미확정 회사 일괄 검색
//   node scripts/kr-company-stats.mjs --probe <seq>          # 상세/기간 응답 원본 확인 (필드 검증용)
//   node scripts/kr-company-stats.mjs --dart-search "회사명"  # DART corp_code 검색
//   node scripts/kr-company-stats.mjs --sync [--apply]       # 수집 → 드라이런 / --apply 시 DB 적재
//
// env(.env.local): DATA_GO_KR_API_KEY(일반 인증키 Decoding), DART_API_KEY
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.trim().startsWith('#')) {
    const k = line.slice(0, i).trim();
    if (!(k in process.env)) process.env[k] = line.slice(i + 1).trim().replace(/^"|"$/g, '');
  }
}

const NPS_KEY = process.env.DATA_GO_KR_API_KEY;
const DART_KEY = process.env.DART_API_KEY;
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NPS_BASE = 'https://apis.data.go.kr/B552015/NpsBplcInfoInqireServiceV2';
const MAPPING_PATH = join(ROOT, 'scripts', 'kr-company-mapping.json');

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const argAfter = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };

// ── XML 응답 파서 (공공데이터 표준 <item> 리스트, 의존성 없이) ──
function parseItems(xml) {
  const items = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const obj = {};
    for (const f of m[1].matchAll(/<(\w+)>([^<]*)<\/\1>/g)) obj[f[1]] = f[2].trim();
    items.push(obj);
  }
  return items;
}
function assertOkXml(xml, ctx) {
  const code = xml.match(/<resultCode>(\w+)<\/resultCode>/)?.[1];
  if (code && code !== '00') {
    const msg = xml.match(/<resultMsg>([^<]*)<\/resultMsg>/)?.[1] || '';
    throw new Error(`${ctx}: API 오류 ${code} ${msg}`);
  }
}

// V2는 요청 파라미터가 camelCase (wkplNm, dataCrtYm, seq)
async function nps(op, params) {
  if (!NPS_KEY) throw new Error('DATA_GO_KR_API_KEY 없음 (.env.local)');
  const qs = new URLSearchParams({ serviceKey: NPS_KEY, numOfRows: '100', pageNo: '1', ...params });
  const r = await fetch(`${NPS_BASE}/${op}?${qs}`);
  const xml = await r.text();
  assertOkXml(xml, op);
  return { items: parseItems(xml), raw: xml };
}
// 사업장 검색. 같은 사업장이 자료생성년월별로 별도 행(별도 seq!)으로 오는 구조라
// seq 는 월마다 바뀐다 — 사업장 식별은 (wkplNm + 사업자번호 앞자리)로 한다.
async function npsSearch(name) {
  const { items, raw } = await nps('getBassInfoSearchV2', { wkplNm: name });
  return { items, raw };
}
// 표시용: 사업장 단위로 묶어 최신 행 + 보유 월수
function groupWorkplaces(items) {
  const by = {};
  for (const it of items) {
    const k = `${it.wkplNm}|${it.bzowrRgstNo || ''}`;
    if (!by[k]) by[k] = { latest: it, months: 0 };
    by[k].months++;
    if ((it.dataCrtYm || '') > (by[k].latest.dataCrtYm || '')) by[k].latest = it;
  }
  return Object.values(by);
}

// 최근 n개월 YYYYMM (자료생성 지연을 감안해 지지난달부터)
function recentYms(n) {
  const out = [];
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 2);
  for (let i = 0; i < n; i++) {
    out.unshift(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}
const num = (v) => (v == null || v === '' ? null : Number(String(v).replace(/[^\d.-]/g, '')) || 0);
const dateOf = (v) => (v && /^\d{8}$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : null);

// ── DART ──
async function dartJson(path, params) {
  if (!DART_KEY) throw new Error('DART_API_KEY 없음 (.env.local)');
  const qs = new URLSearchParams({ crtfc_key: DART_KEY, ...params });
  const r = await fetch(`https://opendart.fss.or.kr/api/${path}?${qs}`);
  return r.json();
}
async function dartCorpIndex() {
  const cache = join(tmpdir(), 'dart-CORPCODE.xml');
  if (!existsSync(cache)) {
    console.log('DART corpCode.xml 다운로드 중…');
    const r = await fetch(`https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${DART_KEY}`);
    const zip = join(tmpdir(), 'dart-corpcode.zip');
    writeFileSync(zip, Buffer.from(await r.arrayBuffer()));
    execSync(`unzip -o -p ${JSON.stringify(zip)} CORPCODE.xml > ${JSON.stringify(cache)}`);
  }
  return readFileSync(cache, 'utf8');
}
async function dartSearch(name) {
  const xml = await dartCorpIndex();
  const out = [];
  for (const m of xml.matchAll(/<list>([\s\S]*?)<\/list>/g)) {
    const corp_name = m[1].match(/<corp_name>([^<]*)<\/corp_name>/)?.[1]?.trim() || '';
    if (!corp_name.includes(name)) continue;
    out.push({
      corp_code: m[1].match(/<corp_code>([^<]*)<\/corp_code>/)?.[1]?.trim(),
      corp_name,
      stock_code: m[1].match(/<stock_code>([^<]*)<\/stock_code>/)?.[1]?.trim() || '',
    });
  }
  return out;
}
// 최근 3개 사업연도 재무 (사업보고서 11011, 없는 해는 건너뜀). 원 단위.
async function dartFinancials(corp_code) {
  const thisYear = new Date().getFullYear();
  const out = [];
  for (let y = thisYear - 1; y >= thisYear - 3; y--) {
    const d = await dartJson('fnlttSinglAcntAll.json', {
      corp_code, bsns_year: String(y), reprt_code: '11011', fs_div: 'OFS',
    });
    if (d.status !== '000' || !Array.isArray(d.list)) continue;
    const pick = (names) => {
      const row = d.list.find((r) => names.includes((r.account_nm || '').replace(/\s/g, '')));
      return row ? num(row.thstrm_amount) : null;
    };
    out.unshift({
      year: y,
      revenue: pick(['매출액', '영업수익', '수익(매출액)']),
      operating_income: pick(['영업이익', '영업이익(손실)']),
      net_income: pick(['당기순이익', '당기순이익(손실)']),
    });
  }
  return out;
}

// ── 회사 1곳 수집: 사업장의 월별 행(각자 seq)을 모아 월별 시계열을 만든다 ──
async function collect(row) {
  const out = { company: row.company, dart_corp_code: row.dart_corp_code || null, fetched_at: new Date().toISOString() };

  const { items } = await npsSearch(row.kr_name);
  const mine = items
    .filter((it) => it.wkplNm === row.kr_name && (!row.bzowr_prefix || (it.bzowrRgstNo || '').startsWith(row.bzowr_prefix)))
    .sort((a, b) => ((a.dataCrtYm || '') < (b.dataCrtYm || '') ? -1 : 1))
    .slice(-12);
  if (!mine.length) throw new Error(`사업장 행 없음 (kr_name/bzowr_prefix 확인: ${row.kr_name})`);

  // 월별: 각 월 seq 로 상세(가입자수)·기간별(취득/상실) 조회
  const monthly = [];
  let latestDet = null;
  for (const mrow of mine) {
    const m = { ym: mrow.dataCrtYm, headcount: null, joined: null, left: null };
    try {
      const d = (await nps('getDetailInfoSearchV2', { seq: mrow.seq })).items[0];
      if (d) { m.headcount = num(d.jnngpCnt); latestDet = d; }
    } catch {}
    try {
      const p = (await nps('getPdAcctoSttusInfoSearchV2', { seq: mrow.seq })).items[0];
      if (p) { m.joined = num(p.nwAcqzrCnt); m.left = num(p.lssJnngpCnt); }
    } catch {}
    if (m.headcount != null || m.joined != null) monthly.push(m);
    await new Promise((r) => setTimeout(r, 120)); // 트래픽 예의
  }
  if (!latestDet) throw new Error('상세 응답 없음');
  out.kr_name = latestDet.wkplNm || row.kr_name;
  out.bzowr_rgst_no = latestDet.bzowrRgstNo || null;
  out.address = latestDet.wkplRoadNmDtlAddr || null;
  out.industry = latestDet.vldtVlKrnNm || null;
  out.registered_at = dateOf(latestDet.adptDt);
  out.headcount = num(latestDet.jnngpCnt);
  out.monthly = monthly;

  // DART (corp_code 있을 때만): 설립일 + 재무
  if (row.dart_corp_code) {
    const prof = await dartJson('company.json', { corp_code: row.dart_corp_code });
    if (prof.status === '000') out.established_at = dateOf(prof.est_dt);
    out.financials = await dartFinancials(row.dart_corp_code);
  }
  return out;
}

async function upsert(rows) {
  // PostgREST 일괄 업서트는 모든 행의 키가 동일해야 함(PGRST102) — 누락 컬럼을 null 로 정규화
  const COLS = ['company', 'kr_name', 'bzowr_rgst_no', 'address', 'industry', 'registered_at',
    'established_at', 'dart_corp_code', 'headcount', 'monthly', 'financials', 'fetched_at'];
  rows = rows.map((row) => Object.fromEntries(COLS.map((c) => [c, row[c] ?? null])));
  const r = await fetch(`${SB_URL}/rest/v1/company_kr_stats?on_conflict=company`, {
    method: 'POST',
    headers: {
      apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`upsert 실패 ${r.status}: ${await r.text()}`);
}

// ── 모드 ──
const searchName = argAfter('--search');
if (searchName && !has('--search-all')) {
  const { items, raw } = await npsSearch(searchName);
  if (!items.length) { console.log('결과 없음. 원본:\n' + raw.slice(0, 800)); process.exit(0); }
  const groups = groupWorkplaces(items);
  for (const g of groups) {
    console.log(`${g.latest.wkplNm}  사업자=${g.latest.bzowrRgstNo || '-'}  상태=${g.latest.wkplJnngStcd || '-'}  ${g.latest.wkplRoadNmDtlAddr || ''}  (${g.months}개월치)`);
  }
  console.log(`\n사업장 ${groups.length}곳. 맞는 곳의 정확한 사업장명을 kr_name 에, 사업자번호 앞 6자리를 bzowr_prefix 에 넣으세요.`);
  process.exit(0);
}

if (has('--search-all')) {
  const mapping = JSON.parse(readFileSync(MAPPING_PATH, 'utf8'));
  for (const row of mapping) {
    if (row.kr_name) continue;
    const q = row.search || row.company;
    try {
      const groups = groupWorkplaces((await npsSearch(q)).items);
      console.log(`\n■ ${row.company} (검색어: ${q}) → 사업장 ${groups.length}곳`);
      for (const g of groups.slice(0, 5)) {
        console.log(`   ${g.latest.wkplNm}  사업자=${g.latest.bzowrRgstNo || '-'}  상태=${g.latest.wkplJnngStcd || '-'}  ${g.latest.wkplRoadNmDtlAddr || ''}`);
      }
      if (!groups.length) console.log('   (한글 법인명을 mapping의 search 필드에 넣고 재시도)');
    } catch (e) {
      console.log(`\n■ ${row.company}: 오류 — ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  process.exit(0);
}

const probeSeq = argAfter('--probe');
if (probeSeq) {
  const det = await nps('getDetailInfoSearchV2', { seq: probeSeq });
  console.log('── getDetailInfoSearch 원본 ──\n' + det.raw.slice(0, 2000));
  const pd = await nps('getPdAcctoSttusInfoSearchV2', { seq: probeSeq, dataCrtYm: recentYms(1)[0] });
  console.log('\n── getPdAcctoSttusInfoSearch 원본 ──\n' + pd.raw.slice(0, 2000));
  process.exit(0);
}

const dartName = argAfter('--dart-search');
if (dartName) {
  const found = await dartSearch(dartName);
  for (const f of found.slice(0, 20)) {
    console.log(`corp_code=${f.corp_code}  ${f.corp_name}${f.stock_code ? `  (상장 ${f.stock_code})` : ''}`);
  }
  console.log(`\n${found.length}건. corp_code 를 mapping의 dart_corp_code 에 넣으세요.`);
  process.exit(0);
}

if (has('--sync')) {
  const apply = has('--apply');
  const mapping = JSON.parse(readFileSync(MAPPING_PATH, 'utf8'));
  const targets = mapping.filter((r) => r.kr_name);
  console.log(`대상 ${targets.length}곳 (매핑 ${mapping.length}곳 중 kr_name 확정분)${apply ? '' : ' — 드라이런, --apply 로 적재'}`);
  const collected = [];
  for (const row of targets) {
    try {
      const c = await collect(row);
      collected.push(c);
      const last = c.monthly[c.monthly.length - 1];
      const fin = c.financials?.[c.financials.length - 1];
      console.log(`✓ ${c.company} (${c.kr_name})  인원 ${c.headcount ?? '-'}명  월데이터 ${c.monthly.length}개월  ` +
        `최근입퇴사 ${last ? `${last.joined ?? '-'}/${last.left ?? '-'}` : '-'}  ` +
        `재무 ${fin ? `${fin.year} 매출 ${fin.revenue != null ? Math.round(fin.revenue / 1e8) + '억' : '-'}` : '없음'}`);
    } catch (e) {
      console.log(`✗ ${row.company}: ${e.message}`);
    }
  }
  if (apply && collected.length) {
    await upsert(collected);
    console.log(`\n✅ ${collected.length}곳 적재 완료 (company_kr_stats)`);
  } else if (!apply) {
    console.log('\n[드라이런] 아무것도 쓰지 않음.');
  }
  process.exit(0);
}

console.log('사용법은 파일 상단 주석 참고 (--search / --search-all / --probe / --dart-search / --sync [--apply])');
