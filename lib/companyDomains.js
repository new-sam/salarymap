// 회사명 → 도메인 큐레이션. 로고는 이 도메인으로 구글 파비콘을 띄운다.
// 홈 회사그리드(api/companies.js)와 회사 페이지가 같은 소스를 쓰도록 공유한다.
export const DOMAIN_MAP = {
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
  'lazada': 'lazada.vn',
  'vnpay': 'vnpay.vn',
  'be group': 'be.com.vn',
}

// 매칭 시 떼어내는 접미/수식어. 'Grab Vietnam'/'VNG Corporation'처럼 풀네임으로
// 등록된 키를 'Grab'/'VNG' 같은 짧은 실제 표기와도 매칭시키기 위함.
const STRIP = new Set([
  'vietnam', 'vn', 'corporation', 'corp', 'group', 'global', 'jsc', 'co',
  'ltd', 'inc', 'company', 'technology', 'tech', 'digital', 'express',
  'software', 'finance', 'solutions', 'services',
])

// 회사명에서 접미/수식어를 제거한 핵심 토큰만 남긴다. 'grab vietnam' -> 'grab'.
function core(name) {
  return (name || '').trim().toLowerCase()
    .replace(/[.,]/g, ' ')
    .split(/\s+/)
    .filter(w => w && !STRIP.has(w))
    .join(' ')
}

// 정규화 인덱스(core -> domain). 먼저 등록된 키가 우선.
const CORE_MAP = {}
for (const [k, v] of Object.entries(DOMAIN_MAP)) {
  const c = core(k)
  if (c && !(c in CORE_MAP)) CORE_MAP[c] = v
}

// 회사명으로 도메인 조회: 정확 일치 → 정규화 일치 순. 없으면 null.
export function domainFor(name) {
  if (!name) return null
  const key = name.trim().toLowerCase()
  if (DOMAIN_MAP[key]) return DOMAIN_MAP[key]
  const c = core(name)
  return (c && CORE_MAP[c]) || null
}

// 도메인으로 로고 URL(구글 파비콘) 생성. 없으면 null.
export function logoUrlFor(domain, size = 128) {
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}` : null
}
