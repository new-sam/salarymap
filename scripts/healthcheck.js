// Site health check — run with: node scripts/healthcheck.js
const checks = [
  {
    name: 'Homepage loads',
    url: 'https://salary-fyi.com',
    validate: (body) => body.includes('salary') && body.includes('FYI'),
  },
  {
    name: 'Jobs page loads',
    url: 'https://salary-fyi.com/jobs',
    validate: (body) => body.includes('jobs') || body.includes('Jobs') || body.includes('FYI'),
  },
  {
    name: 'Companies API returns data',
    url: 'https://salary-fyi.com/api/companies',
    json: true,
    validate: (data) => {
      if (!Array.isArray(data) || data.length < 10) return 'Too few companies: ' + data?.length;
      const withData = data.filter(c => c.hasData);
      if (withData.length < 5) return 'Too few companies with data: ' + withData.length;
      const zeroMedian = withData.filter(c => c.median === 0);
      if (zeroMedian.length > 5) return 'Salary median=0 on ' + zeroMedian.length + ' cards!';
      return true;
    },
  },
  {
    name: 'Jobs API returns data',
    url: 'https://salary-fyi.com/api/jobs',
    json: true,
    validate: (data) => Array.isArray(data) && data.length > 0,
  },
  {
    name: 'Stats API returns data',
    url: 'https://salary-fyi.com/api/stats',
    json: true,
    validate: (data) => data.submissionCount > 0 && data.companyCount > 0,
  },
  {
    name: 'GA4 script present',
    url: 'https://salary-fyi.com',
    validate: (body) => body.includes('G-XK0DH7FKDX'),
  },
  {
    name: 'Meta Pixel present',
    url: 'https://salary-fyi.com',
    validate: (body) => body.includes('865110215480975'),
  },
  {
    name: 'Sitemap accessible',
    url: 'https://salary-fyi.com/sitemap.xml',
    validate: (body) => body.includes('<urlset'),
  },
];

async function run() {
  console.log('=== FYI Salary Health Check ===');
  console.log('Time:', new Date().toISOString(), '\n');

  let pass = 0, fail = 0;

  for (const check of checks) {
    try {
      const start = Date.now();
      const res = await fetch(check.url);
      const time = Date.now() - start;

      if (!res.ok) {
        console.log('FAIL', check.name, '— HTTP', res.status, `(${time}ms)`);
        fail++;
        continue;
      }

      const body = check.json ? await res.json() : await res.text();
      const result = check.validate(body);

      if (result === true) {
        console.log('  OK', check.name, `(${time}ms)`);
        pass++;
      } else {
        console.log('FAIL', check.name, '—', typeof result === 'string' ? result : 'validation failed', `(${time}ms)`);
        fail++;
      }
    } catch (e) {
      console.log('FAIL', check.name, '—', e.message);
      fail++;
    }
  }

  console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
  if (fail > 0) process.exit(1);
}

run();
