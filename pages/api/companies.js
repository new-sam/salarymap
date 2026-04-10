import supabase from '../../lib/supabase';

function removeOutliers(arr) {
  if (arr.length < 4) return arr;
  const sorted = [...arr].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  return sorted.filter(s => s >= q1 - 1.5 * iqr && s <= q3 + 1.5 * iqr);
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? Math.round((s[m - 1] + s[m]) / 2) : s[m];
}

const JUNK_RE = /[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F\u4E00-\u9FFF\u3040-\u30FF]/;
const TEST_RE = /^(test|qwer|asdf|abc|xxx|123|qwd|dwd|fgf|zzz)/i;

function isJunk(company) {
  if (!company || company.trim().length < 2) return true;
  if (JUNK_RE.test(company)) return true;
  if (TEST_RE.test(company.trim())) return true;
  if (company.replace(/[a-zA-ZÀ-ỹ0-9\s.\-&,'()\/]/g, '').length > company.length * 0.4) return true;
  return false;
}

// Domain lookup — companies table has no domain column yet, so we use a hardcoded map
const DOMAIN_MAP = {
  'grab': 'grab.com',
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

function lookupDomain(companyName) {
  return DOMAIN_MAP[companyName.toLowerCase()] || null;
}

// Curated background images per company
const px = id => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=800&h=500&fit=crop`;
const IMAGE_MAP = {
  'Grab Vietnam':    'https://assets.grab.com/wp-content/uploads/sites/11/2024/10/08174304/RV-2x1-GRAB-10Y-1-scaled.jpg',
  'Grab':            'https://assets.grab.com/wp-content/uploads/sites/11/2024/10/08174304/RV-2x1-GRAB-10Y-1-scaled.jpg',
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

function lookupImage(companyName, index) {
  return IMAGE_MAP[companyName] || BG_POOL[index % BG_POOL.length];
}

export default async function handler(req, res) {
  const { data, error } = await supabase
    .from('submissions')
    .select('company, salary, role');

  if (error) return res.status(500).json({ error: error.message });

  // Aggregate by company
  const map = {};
  data.forEach(({ company, salary, role }) => {
    if (isJunk(company)) return;
    if (salary < 5 || salary > 200) return;
    const key = company.trim();
    if (!map[key]) map[key] = { company: key, salaries: [], roles: {} };
    map[key].salaries.push(salary);
    map[key].roles[role] = (map[key].roles[role] || 0) + 1;
  });

  const result = Object.values(map)
    .filter(c => c.salaries.length >= 3)
    .map((c, i) => {
      const clean = removeOutliers(c.salaries);
      const sorted = [...clean].sort((a, b) => a - b);
      const domain = lookupDomain(c.company);
      return {
        company: c.company,
        count: clean.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        median: median(clean),
        domain,
        logo: domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null,
        image: lookupImage(c.company, i),
        topRole: Object.entries(c.roles).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
      };
    })
    .sort((a, b) => b.count - a.count);

  // Compute topPct
  const sortedByMedian = [...result].sort((a, b) => b.median - a.median);
  const enriched = result.map(c => {
    const rank = sortedByMedian.findIndex(x => x.company === c.company);
    const raw = Math.round(((rank + 1) / result.length) * 100);
    const topPct = Math.max(5, Math.round(raw / 5) * 5);
    return { ...c, topPct };
  });

  res.setHeader('Cache-Control', 's-maxage=600');
  res.status(200).json(enriched);
}
