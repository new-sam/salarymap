/**
 * main에 올라간 커밋을 라우트(기능)별로 분류해 events(event='changelog')에 적재.
 * GitHub Actions(push: main)에서 실행. 누가 푸시하든 자동으로 쌓인다.
 * 이미 적재된 커밋은 건너뛴다(멱등).
 */
const { execSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 위에서부터 먼저 매칭. 파일 경로 → 기능(라우트) 라벨.
const ROUTES = [
  [/notify/, '알림 (notify)'],
  [/^pages\/admin\/dashboard|app-metrics|realtime|api\/admin\/dashboard/, '어드민 대시보드'],
  [/^pages\/(api\/)?admin\//, '어드민 (/admin)'],
  [/^pages\/company\/jobs\/new/, '기업 공고 등록 (/company/jobs/new)'],
  [/^(components\/company\/CandidateDetail|pages\/company\/ats|pages\/company\/candidates)/, '기업 ATS (/company/ats)'],
  [/^pages\/auth\/callback/, '기업 가입/온보딩'],
  [/^(pages\/company\b|components\/company\b)/, '기업 (/company)'],
  [/^(pages\/api\/percentile|pages\/api\/stats|lib\/salaryQuality)/, '연봉 통계 (/api/percentile,stats)'],
  [/^(components\/home\/SubmitSection|pages\/index)/, '연봉 위저드 (/)'],
  [/^pages\/jobs(\.js|\/)/, '구직 보드 (/jobs)'],
  [/community/i, '커뮤니티 (/community)'],
  [/^pages\/companies\//, '기업 프로필 (/companies)'],
  [/^pages\/api\/cron|^scripts\//, '크론/자동화'],
];
const classify = (f) => { for (const [re, label] of ROUTES) if (re.test(f)) return label; return null; };

(async () => {
  const { data: existing } = await sb.from('events').select('meta').eq('event', 'changelog').limit(2000);
  const logged = new Set((existing || []).map((r) => r.meta && r.meta.commit).filter(Boolean));

  const lines = execSync('git log -n 40 --no-merges --format=%H%x09%cI%x09%an%x09%s')
    .toString().trim().split('\n').filter(Boolean);

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
    const routes = [...new Set(files.map(classify).filter(Boolean))];
    if (!routes.length) routes.push('기타');
    const category = (subj.match(/^(\w+)/) || ['', 'chore'])[1];
    const summary = subj.replace(/\s*\(#\d+\)\s*$/, '');
    for (const routeLabel of routes) {
      rows.push({ event: 'changelog', created_at: iso, meta: { routeLabel, route: routeLabel, summary, commit: sha, category, actor: author } });
    }
  }

  if (!rows.length) { console.log('changelog: nothing new'); return; }
  const { error } = await sb.from('events').insert(rows);
  console.log(error ? 'changelog ERROR: ' + error.message : `changelog: inserted ${rows.length} entries`);
})().catch((e) => { console.error('changelog ingest failed:', e.message); process.exit(0); });
