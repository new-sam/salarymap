import supabase from '../../lib/supabase';

// Curated background images per company
const px = id => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=800&h=500&fit=crop`;
const IMAGE_MAP = {
  'Grab Vietnam':    'https://assets.grab.com/wp-content/uploads/sites/11/2024/10/08174304/RV-2x1-GRAB-10Y-1-scaled.jpg',
  'Sky Mavis':       'https://cdn.skymavis.com/skymavis-home/public//homepage/about-us-1.jpg',
  'Momo':            'https://boho.vn/wp-content/uploads/2023/03/L6-Momo-001-1024x576.jpg',
  'FPT Software':    'https://fptsoftware.com/-/media/project/fpt-software/fso/about-us/global-presence/f-town/f-town-1.jpg',
  'Shopee Vietnam':  'https://www.sea.com/_next/static/media/bg-shopee.1789debb.jpg',
  'Tiki':            'https://tuyendung.tiki.vn/images/features/about.jpg',
  'GHN':             'https://vstatic.vietnam.vn/vietnam/resource/IMAGE/2026/01/15/1768469557624_giao-hang-nhanhdocx-1768467798800.jpeg',
  'GHN Express':     'https://vstatic.vietnam.vn/vietnam/resource/IMAGE/2026/01/15/1768469557624_giao-hang-nhanhdocx-1768467798800.jpeg',
  'Techcombank':     'https://www.metalocus.es/sites/default/files/files/metalocus_fosterpartners_techcombank_01.jpg',
  'Zalo':            'https://stc-zalo-careers.zdn.vn/v2/assets/images/lifeAtZalo/img1.jpg',
  'KMS Technology':  'https://greatplacetowork.com.vn/wp-content/uploads/2025/02/KMS-TECHNOLOGY_1-2-scaled.jpg',
  'NashTech':        'https://www.outsourceaccelerator.com/wp-content/uploads/2023/05/f7e52632d507ce7029cde7932db75a9a_nashtech-top-10-ict-bpo-2048x1367-1.jpg',
  'Nashtech Global': 'https://www.outsourceaccelerator.com/wp-content/uploads/2023/05/f7e52632d507ce7029cde7932db75a9a_nashtech-top-10-ict-bpo-2048x1367-1.jpg',
  'VNG Corporation': 'https://namthuycorp.com/wp-content/uploads/2020/07/du-an-VNG-1.jpg',
  'VNPT Technology': 'https://architizer-prod.imgix.net/media/mediadata/uploads/1754883372803112358_VNPT_Landscape_2.jpg?w=1680&q=60&auto=format,compress&cs=strip',
  'VPBank':          'https://niceoffice.com.vn/wp-content/uploads/2023/10/vpbank-saigon-tower-duong-ton-duc-thang-quan-1.jpg',
  'MBBank':          px('256559'),
  'SHB Finance':     px('5473955'),
  'Sacombank Digital': px('7821734'),
  'Viettel':         px('1181671'),
  'OneMount Group':  px('3861969'),
  'Logivan':         px('1036808'),
  'Base.vn':         px('3182820'),
  'KiotViet':        px('3184360'),
  'Amanotes':        px('2182973'),
  'Rever':           px('7654202'),
  'Trusting Social': px('6476254'),
  'TokyoTech VN':    px('3861958'),
  'Fossil Group VN': px('3184418'),
  'BHD Star':        px('2182973'),
  'Harvey Nash':     px('3184418'),
  'Axon Active':     px('3861958'),
  'Got It':          px('1181671'),
  'Katalon':         px('3182812'),
  'Teko Vietnam':    px('3184292'),
  'Sendo':           px('3184292'),
};
const BG_POOL = [
  px('3182812'), px('1181244'), px('3184418'), px('256559'),
  px('3861969'), px('1181406'), px('2182973'), px('3184292'),
  px('1181671'), px('3184360'), px('1036808'), px('3861958'),
];

// Domain lookup
const DOMAIN_MAP = {
  'grab vietnam': 'grab.com',
  'vng corporation': 'vng.com.vn',
  'shopee vietnam': 'shopee.vn',
  'fpt software': 'fpt.com.vn',
  'tiki': 'tiki.vn',
  'momo': 'momo.vn',
  'zalo': 'zalo.me',
  'vpbank': 'vpbank.com.vn',
  'techcombank': 'techcombank.com.vn',
  'sky mavis': 'skymavis.com',
  'vnpt technology': 'vnpt.com.vn',
  'shb finance': 'shbfinance.com.vn',
  'onemount group': 'onemount.com',
  'logivan': 'logivan.com',
  'base.vn': 'base.vn',
  'sendo': 'sendo.vn',
  'ghn': 'ghn.vn',
  'ghn express': 'ghn.vn',
  'rever': 'rever.vn',
  'nashtech': 'nashtechglobal.com',
  'nashtech global': 'nashtechglobal.com',
  'kiotviet': 'kiotviet.vn',
  'tokyotech vn': 'tokyotechlab.com',
  'got it': 'got-it.ai',
  'katalon': 'katalon.com',
  'harvey nash': 'harveynash.vn',
  'axon active': 'axonactive.com',
  'teko vietnam': 'teko.vn',
  'bhd star': 'bhdstar.vn',
  'viettel': 'viettel.com.vn',
  'sacombank digital': 'sacombank.com.vn',
  'kms technology': 'kms-technology.com',
  'amanotes': 'amanotes.com',
  'mbbank': 'mbbank.com.vn',
  'fossil group vn': 'fossil.com',
  'trusting social': 'trustingsocial.com',
  'likelion vietnam': 'likelion.net',
  'toss vietnam': 'toss.im',
};

// Map wizard role names to DB role names
const ROLE_MAP = {
  'Data · AI': 'Data Engineer',
  'PM · PO': 'PM',
  'Design': 'Frontend',
  'QA': 'Backend',
};

function resolveRole(role) {
  return ROLE_MAP[role] || role;
}

export default async function handler(req, res) {
  try {
    const { role: rawRole, experience } = req.query;
    const role = rawRole ? resolveRole(rawRole) : null;

    // 1. All companies (source of truth)
    const { data: companies, error: cErr } = await supabase
      .from('companies')
      .select('id, name, tier');

    if (cErr) throw cErr;

    // 2a. Fetch ALL submissions (unfiltered) for total count per company
    const { data: allSubmissions, error: allErr } = await supabase
      .from('submissions')
      .select('company');

    if (allErr) throw allErr;

    // Total count per company (no filters)
    const totalCountMap = {};
    allSubmissions.forEach(s => {
      if (!s.company) return;
      const key = s.company.trim().toLowerCase();
      totalCountMap[key] = (totalCountMap[key] || 0) + 1;
    });

    // 2b. Fetch submissions filtered by role+experience for salary stats
    let query = supabase
      .from('submissions')
      .select('company, salary, role, experience');

    if (role) query = query.eq('role', role);
    if (experience) query = query.eq('experience', experience);

    const { data: submissions, error: sErr } = await query;

    if (sErr) throw sErr;

    // 3. Group filtered submissions by company name (for salary stats only)
    const salaryMap = {};
    submissions.forEach(s => {
      if (!s.company) return;
      const key = s.company.trim().toLowerCase();
      if (!salaryMap[key]) salaryMap[key] = { salaries: [], roles: {} };
      if (s.salary && s.salary >= 5 && s.salary <= 200) {
        salaryMap[key].salaries.push(s.salary);
      }
      if (s.role) salaryMap[key].roles[s.role] = (salaryMap[key].roles[s.role] || 0) + 1;
    });

    const getSummary = (arr) => {
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 === 0
        ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
        : sorted[mid];
      return {
        count: sorted.length,
        median,
        min: sorted[0],
        max: sorted[sorted.length - 1],
      };
    };

    // 4. Join companies + salary data
    const cards = companies.map((co, i) => {
      const key = co.name.trim().toLowerCase();
      const sub = salaryMap[key];
      const hasData = !!(sub && sub.salaries.length >= 3);
      const salaryStats = hasData
        ? getSummary(sub.salaries)
        : { count: 0, median: 0, min: 0, max: 0 };

      // Total count from unfiltered submissions — exact DB value
      const displayCount = totalCountMap[key] || 0;

      const domain = DOMAIN_MAP[key] || null;
      const logo = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null;
      const image = IMAGE_MAP[co.name] || BG_POOL[i % BG_POOL.length];
      const topRole = sub ? Object.entries(sub.roles).sort((a, b) => b[1] - a[1])[0]?.[0] || null : null;

      return {
        id: co.id,
        company: co.name,
        domain,
        logo,
        image,
        tier: co.tier || 3,
        hasData,
        topRole,
        count: displayCount,
        median: salaryStats.median,
        min: salaryStats.min,
        max: salaryStats.max,
      };
    });

    // 5. Compute topPct for companies with data
    const withData = cards.filter(c => c.hasData);
    const sortedByMedian = [...withData].sort((a, b) => b.median - a.median);
    withData.forEach(c => {
      const rank = sortedByMedian.findIndex(x => x.company === c.company);
      const raw = Math.round(((rank + 1) / withData.length) * 100);
      c.topPct = Math.max(5, Math.round(raw / 5) * 5);
    });

    // 6. Sort: hasData first (by count desc), then no data (by tier asc, name asc)
    cards.sort((a, b) => {
      if (a.hasData && !b.hasData) return -1;
      if (!a.hasData && b.hasData) return 1;
      if (a.hasData && b.hasData) return b.count - a.count;
      if (a.tier !== b.tier) return a.tier - b.tier;
      return a.company.localeCompare(b.company);
    });

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    return res.status(200).json(cards);

  } catch (err) {
    console.error('companies API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
