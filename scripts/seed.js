const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://twpxsbnkypocjfnerfmd.supabase.co',
  'sb_publishable_SjIihxmBlpfQjTWVrTybMA_otiXIvWX'
);

// ─── 기준 데이터 ───
const BENCHMARK = {
  'Backend':       { 'Under 1 year':{p25:9,median:12,p75:15},  '1–2 yrs':{p25:14,median:18,p75:24}, '3–4 yrs':{p25:22,median:28,p75:35}, '5–7 yrs':{p25:32,median:40,p75:50}, '8+ yrs':{p25:44,median:55,p75:68} },
  'Frontend':      { 'Under 1 year':{p25:8,median:11,p75:14},  '1–2 yrs':{p25:12,median:16,p75:22}, '3–4 yrs':{p25:19,median:25,p75:32}, '5–7 yrs':{p25:28,median:36,p75:46}, '8+ yrs':{p25:40,median:50,p75:62} },
  'Fullstack':     { 'Under 1 year':{p25:9,median:12,p75:15},  '1–2 yrs':{p25:13,median:17,p75:23}, '3–4 yrs':{p25:21,median:27,p75:34}, '5–7 yrs':{p25:30,median:38,p75:48}, '8+ yrs':{p25:42,median:52,p75:65} },
  'Mobile':        { 'Under 1 year':{p25:10,median:13,p75:16}, '1–2 yrs':{p25:14,median:19,p75:25}, '3–4 yrs':{p25:23,median:30,p75:38}, '5–7 yrs':{p25:33,median:42,p75:54}, '8+ yrs':{p25:46,median:58,p75:72} },
  'Data Engineer': { 'Under 1 year':{p25:10,median:14,p75:18}, '1–2 yrs':{p25:16,median:22,p75:29}, '3–4 yrs':{p25:28,median:36,p75:46}, '5–7 yrs':{p25:40,median:50,p75:62}, '8+ yrs':{p25:52,median:65,p75:80} },
  'DevOps':        { 'Under 1 year':{p25:11,median:15,p75:19}, '1–2 yrs':{p25:17,median:22,p75:29}, '3–4 yrs':{p25:25,median:32,p75:41}, '5–7 yrs':{p25:36,median:45,p75:57}, '8+ yrs':{p25:48,median:60,p75:75} },
  'PM':            { 'Under 1 year':{p25:10,median:14,p75:18}, '1–2 yrs':{p25:15,median:20,p75:27}, '3–4 yrs':{p25:25,median:32,p75:42}, '5–7 yrs':{p25:40,median:50,p75:63}, '8+ yrs':{p25:60,median:75,p75:92} },
};

const ROLES = Object.keys(BENCHMARK);
const EXPERIENCES = ['Under 1 year', '1–2 yrs', '3–4 yrs', '5–7 yrs', '8+ yrs'];
// 경력 분포 (3–4yrs 가장 많게)
const EXP_WEIGHTS = [0.08, 0.18, 0.35, 0.28, 0.11];
const SOURCES = ['facebook', 'zalo', 'linkedin', 'direct'];

// ─── 회사 목록 ───
const TIER1 = [
  'Grab Vietnam', 'VNG Corporation', 'Shopee Vietnam', 'Tiki',
  'Momo', 'FPT Software', 'Zalo', 'Sky Mavis',
  'Techcombank', 'VPBank',
];
const TIER2 = [
  'KMS Technology', 'NashTech', 'Axon Active', 'Harvey Nash',
  'Fossil Group VN', 'GHN', 'Base.vn', 'Rever', 'Got It',
  'Amanotes', 'VNPT Technology', 'Viettel', 'MBBank',
  'Sacombank Digital', 'Teko Vietnam', 'Logivan',
  'OneMount Group', 'Sendo', 'Katalon', 'Trusting Social',
  'KiotViet', 'TokyoTech VN', 'SHB Finance', 'BHD Star',
  'Nashtech Global',
];
const TIER3 = [
  'Vietcombank Digital', 'ACB Digital', 'HDBank IT', 'TPBank', 'MSB Bank',
  'VIB Digital', 'BIDV Technology', 'Agribank IT', 'LienVietPostBank', 'NCB Digital',
  'VinAI Research', 'VinBigData', 'VinSmart', 'Thegioididong Tech', 'FPT Telecom',
  'VNPAY', 'ZaloPay', 'Payoo', 'OnePay', 'SenPay',
  'Lazada Vietnam', 'Shopback Vietnam', 'PropertyGuru VN', 'Batdongsan.com.vn', 'Homedy',
  'iPrice Vietnam', 'Cho Tot', 'Muaban.net', 'Ahamove', 'Lalamove Vietnam',
  'Giaohangtietkiem', 'VietnamWorks', 'TopCV', 'CareerBuilder VN', 'JobStreet Vietnam',
  'ELSA Speak', 'Topica', 'Edupia', 'CoderSchool', 'KidsOnline',
  'DataStory VN', 'Cimigo', 'Nielsen Vietnam', 'Deloitte Vietnam', 'PwC Vietnam',
  'KPMG Vietnam', 'EY Vietnam', 'Bosch Vietnam', 'Siemens Vietnam', 'ABB Vietnam',
  'Schneider Electric VN', 'Honeywell Vietnam', 'GE Digital Vietnam', 'IBM Vietnam', 'Accenture Vietnam',
  'Capgemini Vietnam', 'Cognizant Vietnam', 'Wipro Vietnam', 'TCS Vietnam', 'Infosys Vietnam',
  'DXC Technology VN', 'Hitachi Vantara VN', 'Fujitsu Vietnam', 'NEC Vietnam', 'Panasonic R&D VN',
];

// ─── 유틸 함수 ───
function rand(min, max) {
  return Math.round(min + Math.random() * (max - min));
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function weightedPick(arr, weights) {
  const r = Math.random();
  let cum = 0;
  for (let i = 0; i < arr.length; i++) {
    cum += weights[i];
    if (r < cum) return arr[i];
  }
  return arr[arr.length - 1];
}
function randomDate(daysBack) {
  const now = Date.now();
  const past = now - daysBack * 24 * 60 * 60 * 1000;
  return new Date(past + Math.random() * (now - past)).toISOString();
}
function genSalary(role, exp, multiplier) {
  const b = BENCHMARK[role][exp];
  // p25~p75 범위 내에서 정규분포 근사 (median 중심)
  const base = b.p25 + Math.random() * (b.p75 - b.p25);
  // 5% 확률로 outlier (p75 초과)
  const salary = Math.random() < 0.05
    ? b.p75 + rand(1, Math.round(b.p75 * 0.4))
    : base;
  return Math.round(salary * multiplier);
}

// ─── 제출 데이터 생성 ───
function makeRows(company, count, multiplierMin, multiplierMax) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    const role = pick(ROLES);
    const exp = weightedPick(EXPERIENCES, EXP_WEIGHTS);
    const multiplier = multiplierMin + Math.random() * (multiplierMax - multiplierMin);
    rows.push({
      role,
      experience: exp,
      salary: genSalary(role, exp, multiplier),
      company,
      source: pick(SOURCES),
      created_at: randomDate(90),
    });
  }
  return rows;
}

async function insertBatch(rows) {
  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from('submissions').insert(batch);
    if (error) console.error('insert error:', error.message);
    else process.stdout.write('.');
  }
}

async function main() {
  // ── 1. companies 테이블에 전체 회사 삽입 ──
  console.log('\n[1] companies 삽입 중...');
  const allCompanies = [
    ...TIER1.map(name => ({ name, tier: 1 })),
    ...TIER2.map(name => ({ name, tier: 2 })),
    ...TIER3.map(name => ({ name, tier: 3 })),
  ];
  const { error: compErr } = await supabase.from('companies').upsert(allCompanies, { onConflict: 'name' });
  if (compErr) console.error('companies error:', compErr.message);
  else console.log(`  ${allCompanies.length}개 완료`);

  // ── 2. submissions 더미 데이터 ──
  console.log('\n[2] submissions 삽입 중...');
  let allRows = [];

  // Tier 1: 회사당 30~40개
  for (const co of TIER1) {
    allRows.push(...makeRows(co, rand(30, 40), 1.10, 1.30));
  }
  // Tier 2: 회사당 6~12개
  for (const co of TIER2) {
    allRows.push(...makeRows(co, rand(6, 12), 1.00, 1.15));
  }

  // 셔플
  allRows = allRows.sort(() => Math.random() - 0.5);

  console.log(`  총 ${allRows.length}개 생성, 삽입 시작...`);
  await insertBatch(allRows);

  console.log(`\n\n완료! submissions: ${allRows.length}개, companies: ${allCompanies.length}개`);
}

main().catch(console.error);
