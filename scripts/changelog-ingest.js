/**
 * main(운영) 배포 시 그 커밋들을 라우트(기능)별로 분류해 events(event='changelog')에 적재.
 * Vercel 운영 빌드의 prebuild 단계에서 실행 — 누가 푸시하든 자동으로 쌓인다.
 * 안전장치: 운영 빌드에서만 동작 / 멱등(이미 적재된 sha 스킵) / 타임아웃·에러 시 조용히 exit 0
 * (어떤 경우에도 빌드를 깨지 않는다)
 */
const { execSync } = require('child_process');

// 빌드를 절대 막지 않도록 하드 타임아웃
const timer = setTimeout(() => { console.log('changelog: timeout, skip'); process.exit(0); }, 20000);
const done = (msg) => { if (msg) console.log(msg); clearTimeout(timer); process.exit(0); };

// 운영(production) 빌드에서만. 프리뷰/로컬은 스킵.
if (process.env.VERCEL && process.env.VERCEL_ENV !== 'production') done('changelog: non-prod, skip');
if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) done('changelog: no supabase env, skip');

// 네비게이션 기준 버킷. 파일 경로 → 네비 섹션. 위에서부터 먼저 매칭.
// (lib/translations, lib/i18n 등 부수 파일은 null → 무시: 스퍼리어스 분류 방지)
const ROUTES = [
  [/^(pages\/admin\/|pages\/api\/admin\/|components\/admin\/)/, '⚙️ 어드민'],
  [/^(pages\/cv(\.js|\/)|components\/cv\/)/, '이력서 등록 (/cv)'],
  [/community/i, '커뮤니티 (/community)'],
  [/^(pages\/for-companies|pages\/companies\/|pages\/company\b|pages\/company\/|components\/company\/|pages\/api\/company\/|pages\/auth\/callback)/, '기업 서비스 (/for-companies)'],
  [/notify/, '기업 서비스 (/for-companies)'],
  [/^(pages\/jobs(\.js|\/)|pages\/api\/jobs|pages\/api\/job-)/, '채용 공고 (/jobs)'],
  [/^(pages\/profile|pages\/my-applications|pages\/saved-jobs|pages\/api\/profile|pages\/api\/my-applications|pages\/api\/job-bookmarks)/, '내 프로필 (/profile)'],
  [/^(pages\/index|components\/home\/|components\/AnonymousSection|pages\/api\/percentile|pages\/api\/stats|pages\/api\/submit|pages\/api\/result|lib\/salaryQuality)/, '연봉 비교 (/)'],
  [/^(components\/GlobalNav|components\/MobileTabBar|components\/MobileNav|pages\/_app|pages\/_document)/, '네비/공통'],
  [/^(pages\/api\/cron|scripts\/)/, '크론/자동화'],
];
const classifyFile = (f) => { for (const [re, label] of ROUTES) if (re.test(f)) return label; return null; };
// 파일을 못 읽는 얕은 클론 대비 — 커밋 스코프(feat(admin) 등)로 폴백 분류
const SCOPE = {
  admin: '⚙️ 어드민', premium: '⚙️ 어드민',
  cv: '이력서 등록 (/cv)', community: '커뮤니티 (/community)',
  company: '기업 서비스 (/for-companies)', notify: '기업 서비스 (/for-companies)',
  jobs: '채용 공고 (/jobs)', profile: '내 프로필 (/profile)',
  salary: '연봉 비교 (/)', nav: '네비/공통',
};
const scopeRoute = (subj) => {
  const m = subj.match(/^\w+\(([^)]+)\)/);
  if (!m) return null;
  for (const s of m[1].split(',').map((x) => x.trim().toLowerCase())) if (SCOPE[s]) return SCOPE[s];
  return null;
};

(async () => {
  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: existing } = await sb.from('events').select('meta').eq('event', 'changelog').limit(3000);
  const logged = new Set((existing || []).map((r) => r.meta && r.meta.commit).filter(Boolean));

  let lines = [];
  try {
    lines = execSync('git log -n 30 --no-merges --format=%H%x09%cI%x09%an%x09%s').toString().trim().split('\n').filter(Boolean);
  } catch (_) { done('changelog: git unavailable, skip'); }

  const rows = [];
  for (const line of lines) {
    const [full, iso, author, subj] = line.split('\t');
    const sha = full.slice(0, 7);
    if (logged.has(sha) || logged.has(full)) continue;
    let files = [];
    try {
      files = execSync(`git show --stat --format="" ${full}`).toString()
        .split('\n').map((l) => l.trim().split(' ')[0]).filter((f) => /\.(js|jsx|ts|tsx|sql)$/.test(f));
    } catch (_) {}
    let routes = [...new Set(files.map(classifyFile).filter(Boolean))];
    if (!routes.length) { const s = scopeRoute(subj); routes = [s || '기타']; }
    const category = (subj.match(/^(\w+)/) || ['', 'chore'])[1];
    const summary = subj.replace(/\s*\(#\d+\)\s*$/, '');
    for (const routeLabel of routes) {
      rows.push({ event: 'changelog', created_at: iso, meta: { routeLabel, route: routeLabel, summary, commit: sha, category, actor: author } });
    }
  }

  if (!rows.length) done('changelog: nothing new');
  const { error } = await sb.from('events').insert(rows);
  done(error ? 'changelog ERROR: ' + error.message : `changelog: inserted ${rows.length}`);
})().catch((e) => done('changelog ingest failed: ' + e.message));
