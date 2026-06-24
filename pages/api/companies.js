import supabase from '../../lib/supabaseAdmin';
import { domainFor } from '../../lib/companyDomains';

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

// Paginate through all rows (Supabase caps at 1000 per request)
async function fetchAll(query) {
  const PAGE = 1000;
  let all = [], from = 0;
  while (true) {
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// The `companies` table holds case/whitespace-variant duplicate rows
// (e.g. "FPT Software" / "fpt software" / "FPT software") that all normalize
// to the same salary bucket. Collapse them to one card per normalized name,
// keeping the best-cased variant so the same company never shows twice.
function dedupeCompanies(companies) {
  const byKey = new Map();
  const score = c =>
    (IMAGE_MAP[c.name] ? 4 : 0) +                  // curated image → the real display name
    (c.name !== c.name.toLowerCase() ? 2 : 0) +    // has capitalization
    (5 - (c.tier || 3)) * 0.1;                      // tiebreak: slight nudge to higher tier
  for (const co of companies) {
    const key = co.name.trim().toLowerCase();
    const cur = byKey.get(key);
    if (!cur || score(co) > score(cur)) byKey.set(key, co);
  }
  return [...byKey.values()];
}

// Per-company salary stats, keyed by normalized (lower+trim) company name.
// Shape: { [key]: { count, median, min, max, topRole } }
async function fetchSalaryStats(role, experience) {
  const map = {};

  // Preferred path: Postgres aggregation via RPC.
  // PostgREST caps each response at 1000 rows, so paginate with .range() —
  // the RPC's `order by` makes the slices stable. (>1000 companies have data.)
  const PAGE = 1000;
  let from = 0;
  let rpcFailed = false;
  while (true) {
    const { data, error } = await supabase
      .rpc('get_company_salary_stats', { p_role: role || null, p_experience: experience || null })
      .range(from, from + PAGE - 1);
    if (error) {
      console.warn('get_company_salary_stats RPC unavailable, falling back:', error.message);
      rpcFailed = true;
      break;
    }
    if (!data || data.length === 0) break;
    data.forEach(r => {
      const key = (r.company || '').trim().toLowerCase();
      if (!key) return;
      map[key] = {
        count: Number(r.cnt) || 0,
        median: r.median != null ? Math.round(Number(r.median)) : 0,
        min: r.min_salary != null ? Number(r.min_salary) : 0,
        max: r.max_salary != null ? Number(r.max_salary) : 0,
        topRole: r.top_role || null,
      };
    });
    if (data.length < PAGE) break;
    from += PAGE;
  }

  if (!rpcFailed) return map;

  // Fallback: client-side aggregation (RPC not deployed) — discard any partial RPC data
  for (const k in map) delete map[k];
  const raw = {};
  let q = supabase.from('submissions').select('company, salary, role, experience');
  if (role) q = q.eq('role', role);
  if (experience) q = q.eq('experience', experience);
  const rows = await fetchAll(q);
  (rows || []).forEach(s => {
    if (!s.company) return;
    const key = s.company.trim().toLowerCase();
    if (!raw[key]) raw[key] = { salaries: [], roles: {} };
    if (s.salary && s.salary >= 5 && s.salary <= 200) raw[key].salaries.push(s.salary);
    if (s.role) raw[key].roles[s.role] = (raw[key].roles[s.role] || 0) + 1;
  });
  Object.entries(raw).forEach(([key, v]) => {
    const sorted = [...v.salaries].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length === 0 ? 0
      : sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
      : sorted[mid];
    map[key] = {
      count: sorted.length,
      median,
      min: sorted[0] || 0,
      max: sorted[sorted.length - 1] || 0,
      topRole: Object.entries(v.roles).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    };
  });
  return map;
}

// 회사 카드 계산(연봉 집계 + 정렬 + payload 슬림화). 무거운 부분 전부가 여기 모인다.
// role/experience 없으면 기본 뷰(모바일/홈) — cron이 미리 계산해 company_cards_cache에 적재한다.
export async function computeCompanyCards(role, experience) {
  // 1. All companies (source of truth) — paginate past Supabase's 1000-row cap,
  //    then collapse case/whitespace-variant duplicate rows into one per company.
  const companies = dedupeCompanies(await fetchAll(
    supabase.from('companies').select('id, name, tier')
  ));

  // 2. Salary stats — server-side aggregation via RPC. Single source for
  //    count/median/min/max/topRole so they always come from the same
  //    normalized-company bucket. Falls back to client-side aggregation if
  //    the RPC isn't deployed.
  const salaryMap = await fetchSalaryStats(role, experience);

  // 3. Join companies + salary data
  const cards = companies.map((co, i) => {
    const key = co.name.trim().toLowerCase();
    const sub = salaryMap[key];
    const hasData = !!(sub && sub.count >= 1);
    const salaryStats = hasData
      ? { count: sub.count, median: sub.median, min: sub.min, max: sub.max }
      : { count: 0, median: 0, min: 0, max: 0 };

    const domain = domainFor(co.name);
    const image = IMAGE_MAP[co.name] || BG_POOL[i % BG_POOL.length];
    const topRole = hasData ? sub.topRole || null : null;

    return {
      name: co.name,
      domain,
      image,
      tier: co.tier || 3,
      hasData,
      topRole,
      count: salaryStats.count,
      median: salaryStats.median,
      min: salaryStats.min,
      max: salaryStats.max,
    };
  });

  // 5. Compute topPct for companies with data
  const withData = cards.filter(c => c.hasData);
  const sortedByMedian = [...withData].sort((a, b) => b.median - a.median);
  withData.forEach(c => {
    const rank = sortedByMedian.findIndex(x => x.name === c.name);
    const raw = Math.round(((rank + 1) / withData.length) * 100);
    c.topPct = Math.max(5, Math.round(raw / 5) * 5);
  });

  // 6. Sort: hasData first (by count desc), then no data (by tier asc, name asc)
  cards.sort((a, b) => {
    if (a.hasData && !b.hasData) return -1;
    if (!a.hasData && b.hasData) return 1;
    if (a.hasData && b.hasData) return b.count - a.count;
    if (a.tier !== b.tier) return a.tier - b.tier;
    return a.name.localeCompare(b.name);
  });

  // Strip heavy fields from cards without data to reduce payload
  return cards.map(c => {
    if (!c.hasData) {
      const { image, topRole, topPct, ...rest } = c;
      return rest;
    }
    return c;
  });
}

const LIST_CACHE = 'public, max-age=300, s-maxage=1800, stale-while-revalidate=3600';

export default async function handler(req, res) {
  try {
    const { role: rawRole, experience } = req.query;
    const role = rawRole ? resolveRole(rawRole) : null;

    // 기본 뷰(필터 없음 = 모바일/홈)는 cron이 미리 계산해둔 캐시 테이블을 읽어 콜드 집계(~3초)를 피한다.
    if (!role && !experience) {
      const { data: cacheRow } = await supabase
        .from('company_cards_cache').select('cards').eq('id', 1).maybeSingle();
      if (cacheRow?.cards) {
        res.setHeader('Cache-Control', LIST_CACHE);
        return res.status(200).json(cacheRow.cards);
      }
      // 캐시가 비어 있으면(최초 배포 직후 등) 라이브 계산 후 캐시를 채운다(self-heal). 쓰기는 실패해도 무시.
      const fresh = await computeCompanyCards(null, null);
      supabase.from('company_cards_cache')
        .upsert({ id: 1, cards: fresh, updated_at: new Date().toISOString() })
        .then(() => {}, () => {});
      res.setHeader('Cache-Control', LIST_CACHE);
      return res.status(200).json(fresh);
    }

    // 필터(role/experience) 지정 — 라이브 계산(웹 위저드 등, 빈도 낮음).
    const lightCards = await computeCompanyCards(role, experience);
    res.setHeader('Cache-Control', LIST_CACHE);
    return res.status(200).json(lightCards);

  } catch (err) {
    console.error('companies API error:', err);
    return res.status(500).json({ error: err.message });
  }
}

