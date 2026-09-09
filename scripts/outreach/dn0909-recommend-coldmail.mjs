// 다낭 9월 이벤트 recommend(Mia 9/9 요청) — Nalda·Bada Fintech(3)·Jinosys·Nexacode(2) 7개 JD를
// 다낭 거주 후보에게 재발송. Komang·S2E·Overlay(최근 발송)·Andwise(다낭 풀 보유)는 제외 지시.
// 9/9 다낭 풀 실측(이력서·unsub 제외): 232명 — Fullstack 66·Backend 45·Non-IT 21·Frontend 17·Design 13·Marketing 13.
// 재발송 규칙: 기지원자만 제외, 기추천자는 포함(전 발송 7/16~8/25, 2주+ 경과). 캠페인 dn0909-recommend-*
//   (dn0909 접두 = coldmailTemplates 구 regex(/^nalda-/, /^bada-/) 오매치 방지 · 'recommend' 포함 = goals탭 그룹 분류).
// ⚠️ Bada plan JD는 8/21 발송 당시와 다름 — 시장개발로 개편(TOPIK 요건 폐지, 영어 필수, 다낭→한국 근무 기회).
// ktc0907b 패턴: 룰 캐스케이드(요건 좁은 순) → 1인1통(당일 발송자 제외) → 공개/비공개 프레임.
//
//   node scripts/outreach/dn0909-recommend-coldmail.mjs                          # dry-run
//   node scripts/outreach/dn0909-recommend-coldmail.mjs --send [--group nalda-fs] [--max N]
import { Resend } from 'resend'
import { sb, env, fetchAll } from './lib.mjs'
import { makeToken } from '../../lib/campaignToken.js'

const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d }
const doSend = args.includes('--send')
const onlyGroup = flag('group', null)
const maxN = flag('max', null) ? parseInt(flag('max'), 10) : null
const SITE = String(flag('site', env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com')).replace(/\/$/, '')
const RESEND_FROM = env.RESEND_FROM || 'FYI <hello@salary-fyi.com>'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const firstName = (n) => String(n || '').trim().split(/\s+/).slice(-1)[0] || 'bạn'
const strip = (s) => String(s).replace(/<[^>]+>/g, '')

const JOBS = {
  NALDA: 'b45ca362-f1c9-41a7-8d95-a186a943ff16', // NALDA Full-Stack Developer (Đà Nẵng)
  BADA_PLAN: 'b8d6ebd8-d99c-466d-a4ff-6f730185639f', // Bada 핀테크 시장개발 (Đà Nẵng→한국)
  BADA_UIUX: '7f214858-225d-44b5-8bc0-f354743704d9', // Bada Frontend & UI/UX Localization (Đà Nẵng)
  BADA_MKT: '20099dc4-894b-464b-979a-27fe90c37c2e', // Bada Content & Performance Marketing (Đà Nẵng)
  JINO: '6e4d1552-783f-463a-bd52-bc118830fa27', // Jinosys Mobile App & Web (IoT, Đà Nẵng)
  NX_SALES: '2c16fea9-44ce-4a6d-8556-acd28d3a6a3e', // Nexacode B2B Sales & Marketing (리모트)
  NX_DESIGN: '71907b33-f58b-4955-9ec4-e4398beb3ffd', // Nexacode Web/Graphic Designer (리모트)
}

// ── 대상 선정(룰 기반, 전부 다낭 거주 게이트) ──
const norm = (v) => (Array.isArray(v) ? v.join(' ') : String(v || ''))
const txt = (p) => {
  const exp = Array.isArray(p.experiences) ? p.experiences.map((e) => `${e.title || e.position || ''} ${e.company || ''}`).join(' ') : ''
  return [p.position, p.headline, norm(p.desired_roles), norm(p.skills), exp, JSON.stringify(p.resume_summary || ''), p.university].join(' ').toLowerCase()
}
const roles = (p) => new Set([p.position, ...(p.desired_roles || [])].filter(Boolean))
const hasAny = (p, arr) => [...roles(p)].some((r) => arr.includes(r))
const y = (p) => p.yoe_months ?? 0
const inDanang = (p) => /(đà nẵng|da ?nang|đa nẵng)/i.test(String(p.location || ''))
const koLevel = (p) => {
  const c = String(p.korean_cert || '')
  const m = c.match(/topik\D*(\d)/i)
  if (m) return parseInt(m[1], 10)
  if (/fluent|advanced|native|thành thạo/i.test(c)) return 5
  if (c && !/none|basic|beginner/i.test(c)) return 2
  return 0
}
const BIZISH = /business|analyst|기획|planning|product|operations|finance|bank|fintech|consult|coordinator|interpreter|translat|sales|research|marketing/i
const BIZ_POS = ['PM', 'Business Analyst', 'Operations', 'Non-IT', 'Interpreter', 'Sales', 'Marketing', 'Finance', 'Sales Admin']
const DEV_POS = ['Fullstack', 'Frontend', 'Backend', 'Web', 'Embedded', 'AI Engineer', 'ML Engineer', 'AI/Data']
// 개발직군은 경력 텍스트에 business/bank 류 단어가 흔해 비개발 JD에 오탐됨 — 비개발 그룹은 position 게이트 필수
const DEVISH = new Set([...DEV_POS, 'Mobile', 'QA', 'QA Automation', 'DevOps', 'Game', 'Data Scientist', 'Data Engineer', 'Security Engineer', 'Cloud', 'SRE', 'Tech Lead', 'Data Analyst'])
const nonDev = (p) => !DEVISH.has(String(p.position))
const mobileRe = /(android|kotlin|flutter|react.?native|swift|\bios\b)/i

// 캐스케이드 순서 = 배정 우선순위(다낭 매치 좁은 순 실측: plan→mkt→uiux→nalda→sales→design→jinosys), 1인 1그룹.
const GROUPS = [
  {
    gkey: 'bada-plan', jobKey: 'BADA_PLAN', camp: 'dn0909-recommend-bada-plan',
    company: 'Bada Fintech', initial: 'B', meta: 'Đà Nẵng → Hàn Quốc · 25–30 triệu ₫',
    label: { vi: 'Chuyên viên Phát triển Thị trường Fintech', ko: '핀테크 시장개발' },
    // 개편 JD: 서비스운영/기획/시장조사 경험 × 영어 필수, 한국어·핀테크는 가점 (TOPIK 게이트 폐지).
    // 비개발 position 한정(개발자 텍스트 오탐 방지), Marketing·Design은 각자 그룹 소관이라 제외.
    pick: (p) => {
      if (!p.english_cert || !nonDev(p) || ['Marketing', 'Design'].includes(String(p.position))) return null
      if (!(BIZISH.test(txt(p)) || BIZ_POS.includes(String(p.position)))) return null
      return 2 + (koLevel(p) >= 2 ? 2 : 0) + (/fintech|bank|finance/i.test(txt(p)) ? 2 : 0) + (/research|market/i.test(txt(p)) ? 1 : 0)
    },
    intro: '<b>Bada Fintech</b> — công ty fintech Hàn Quốc về giải pháp tài chính khoản phải thu (Supply Chain Finance), kết nối với Ngân hàng Hana tại Hàn Quốc và Việt Nam — đang tuyển <b>Chuyên viên Phát triển Thị trường Fintech</b> qua FYI tại <b>Đà Nẵng</b>, có cơ hội sang <b>Hàn Quốc</b> làm việc sau 1–2 tháng đánh giá (chưa có visa vẫn ứng tuyển được). Yêu cầu: kinh nghiệm vận hành dịch vụ / hoạch định sản phẩm / nghiên cứu thị trường và tiếng Anh giao tiếp tốt; tiếng Hàn là lợi thế.',
  },
  {
    gkey: 'bada-mkt', jobKey: 'BADA_MKT', camp: 'dn0909-recommend-bada-mkt',
    company: 'Bada Fintech', initial: 'B', meta: 'Onsite · Đà Nẵng',
    label: { vi: 'Content & Performance Marketing Specialist', ko: '콘텐츠·퍼포먼스 마케팅' },
    pick: (p) => {
      const t = txt(p)
      if (!(String(p.position) === 'Marketing' || (nonDev(p) && /marketing|content creat|performance|growth|tiktok|social media/i.test(t)))) return null
      let s = 0
      if (/performance|paid (ads|media)|meta ads|google ads|facebook ads|media buy/i.test(t)) s += 3
      if (/content|tiktok|social media|creative/i.test(t)) s += 2
      if (/growth|seo/i.test(t)) s += 1
      if (y(p) >= 12) s += 1
      return s >= 2 ? s : null
    },
    intro: '<b>Bada Fintech</b> — công ty fintech Hàn Quốc về giải pháp tài chính khoản phải thu (Supply Chain Finance), kết nối với Ngân hàng Hana tại Hàn Quốc và Việt Nam — đang tuyển <b>Content & Performance Marketing Specialist</b> qua FYI, làm việc tại <b>Đà Nẵng</b>. Ưu tiên kinh nghiệm content·social media hoặc quảng cáo hiệu suất (Meta/Google Ads).',
  },
  {
    gkey: 'bada-uiux', jobKey: 'BADA_UIUX', camp: 'dn0909-recommend-bada-uiux',
    company: 'Bada Fintech', initial: 'B', meta: 'Onsite · Đà Nẵng',
    label: { vi: 'Frontend & UI/UX Localization Specialist', ko: 'UI/UX·프론트엔드 로컬라이제이션' },
    pick: (p) => {
      const t = txt(p)
      const isDesign = String(p.position) === 'Design' || /ui\/?ux|product design|ux design/i.test(t)
      const isFe = String(p.position) === 'Frontend' && /ui|ux|figma|design/i.test(t)
      if (!isDesign && !isFe) return null
      let s = 0
      if (/figma/i.test(t)) s += 2
      if (/ui\/?ux|product design/i.test(t)) s += 2
      if (/mobile|app design|ios|android/i.test(t)) s += 1
      if (isFe) s += 1
      if (y(p) >= 12) s += 1
      return s >= 2 ? s : null
    },
    intro: '<b>Bada Fintech</b> — công ty fintech Hàn Quốc về giải pháp tài chính khoản phải thu (Supply Chain Finance), kết nối với Ngân hàng Hana tại Hàn Quốc và Việt Nam — đang tuyển <b>Frontend & UI/UX Localization Specialist</b> qua FYI, làm việc tại <b>Đà Nẵng</b>. Ưu tiên kinh nghiệm UI/UX·Figma và khả năng bản địa hóa giao diện sản phẩm.',
  },
  {
    gkey: 'nalda-fs', jobKey: 'NALDA', camp: 'dn0909-recommend-nalda-fs',
    company: 'NALDA', initial: 'N', meta: 'Onsite · Đà Nẵng',
    label: { vi: 'Full-Stack Developer', ko: '풀스택 개발자' },
    // nalda-recommend1 룰 유지: React+TS 필수, 6개월~8년, Firebase·JD 경력대(1~5y)·모바일 가점
    pick: (p) => {
      const t = txt(p)
      if (!t.includes('react') || !t.includes('typescript')) return null
      if (p.yoe_months != null && (p.yoe_months < 6 || p.yoe_months > 96)) return null
      let s = 0
      if (t.includes('firebase')) s += 3
      if (p.yoe_months != null && p.yoe_months >= 12 && p.yoe_months <= 60) s += 2
      if (mobileRe.test(t)) s += 1
      return s
    },
    intro: '<b>NALDA</b> — công ty công nghệ vận hành ứng dụng quản lý thời gian <b>Timing</b> — đang tuyển <b>Full-Stack Developer</b> qua FYI, làm việc tại <b>Đà Nẵng</b>. Yêu cầu chính: <b>React · TypeScript</b> (Firebase là lợi thế), phù hợp kinh nghiệm 1–5 năm.',
  },
  {
    gkey: 'nx-sales', jobKey: 'NX_SALES', camp: 'dn0909-recommend-nx-sales',
    company: 'Nexacode', initial: 'N', meta: 'Remote (HCM · Hà Nội · Đà Nẵng)',
    label: { vi: 'B2B Sales & Marketing Executive', ko: 'B2B 세일즈·마케팅' },
    // NX502 JD: 경력 무관("B2B에 관심"), 문서·이메일 커뮤니케이션 — 세일즈/마케팅/사무 인접 직군(비개발 한정)
    pick: (p) => {
      const t = txt(p)
      if (!nonDev(p)) return null
      if (!(hasAny(p, BIZ_POS) || /sales|marketing|business development|b2b|customer|account manage/i.test(t))) return null
      return (/(b2b|outbound|cold ?(email|call)|crm)/i.test(t) ? 3 : 0) + (hasAny(p, ['Sales', 'Marketing']) ? 2 : 0) + (p.english_cert ? 1 : 0)
    },
    intro: '<b>Nexacode</b> — công ty phần mềm xây dựng sản phẩm SaaS, ERP và giải pháp chuyển đổi số — đang tuyển <b>B2B Sales & Marketing Executive</b> làm việc <b>hoàn toàn từ xa (remote)</b>. <b>Không yêu cầu kinh nghiệm</b> — chỉ cần quan tâm đến B2B sales/marketing, có khả năng nghiên cứu doanh nghiệp và giao tiếp tốt qua email·văn bản; kinh nghiệm cold email, CRM hay công cụ AI (ChatGPT, v.v.) là lợi thế.',
  },
  {
    gkey: 'nx-design', jobKey: 'NX_DESIGN', camp: 'dn0909-recommend-nx-design',
    company: 'Nexacode', initial: 'N', meta: 'Remote',
    label: { vi: 'Web / Graphic Designer', ko: '웹/그래픽 디자이너' },
    // NXGD JD(8/25 그래픽 전환): 경력 요건 없음, Figma·시각디자인 기본기 — 디자인 직군 or 그래픽 시그널.
    // 최소 2점(nx-graphic LLM 채점 3/5+ 전례의 룰 근사) — 텍스트 오탐 컷.
    pick: (p) => {
      const t = txt(p)
      const isDesign = hasAny(p, ['Design']) || /designer|graphic design|thiết kế/i.test(t)
      const gfx = /(graphic|photoshop|illustrator|banner|thumbnail|landing page)/i.test(t)
      if (!isDesign && !gfx) return null
      const s = (gfx ? 2 : 0) + (/figma/i.test(t) ? 2 : 0) + (/content|marketing|sns|social/i.test(t) ? 1 : 0) + (hasAny(p, ['Design']) ? 1 : 0)
      return s >= 2 ? s : null
    },
    intro: '<b>Nexacode</b> — công ty phần mềm xây dựng sản phẩm SaaS, ERP và giải pháp chuyển đổi số — đang tuyển <b>Web / Graphic Designer</b> làm việc <b>hoàn toàn từ xa (remote)</b>. Công việc tập trung vào thiết kế ấn phẩm quảng cáo số·banner, nội dung SNS·thumbnail, landing page·trang khuyến mãi, website doanh nghiệp·brand, cùng tài liệu doanh nghiệp (PPT, proposal). Yêu cầu sử dụng thành thạo <b>Figma</b>, có nền tảng thiết kế thị giác và portfolio; kinh nghiệm Photoshop·Illustrator là lợi thế.',
  },
  {
    gkey: 'jinosys-mobile', jobKey: 'JINO', camp: 'dn0909-recommend-jinosys-mobile',
    company: 'Jinosys', initial: 'J', meta: 'Onsite · Đà Nẵng',
    label: { vi: 'Mobile App & Web Service Developer (IoT Platform)', ko: '모바일·웹 개발자(IoT)' },
    // JD 스택: PHP·HTML5/CSS3·JS·Android(Java/Kotlin), AI(TF·PyTorch Mobile)·API 우대.
    // Mobile/Web 직군은 통과, 그 외 개발직군은 모바일/PHP/IoT/AI 스택 시그널 필요(JS만으로는 미달 — 살포 방지).
    pick: (p) => {
      const t = txt(p)
      const stack = mobileRe.test(t) || /(php|laravel|\biot\b|tensorflow|pytorch)/i.test(t)
      if (!hasAny(p, ['Mobile', 'Web']) && !(hasAny(p, DEV_POS) && stack)) return null
      return (mobileRe.test(t) ? 2 : 0) + (/php|laravel/i.test(t) ? 1 : 0) + (/tensorflow|pytorch|machine learning|deep learning/i.test(t) ? 1 : 0) + (/\biot\b|embedded/i.test(t) ? 1 : 0)
    },
    intro: '<b>Jinosys</b> — công ty Hàn Quốc chuyên nền tảng IoT an toàn dựa trên AI (18 bằng sáng chế, gần 10 năm là đối tác an toàn của Samsung Electronics) — đang tuyển <b>Mobile App & Web Service Developer (IoT Platform)</b> qua FYI, làm việc tại <b>Đà Nẵng</b>. Stack chính: <b>PHP · HTML5/CSS3 · JavaScript · Android (Java/Kotlin)</b>; kinh nghiệm AI (TensorFlow, PyTorch Mobile) và tích hợp API là lợi thế.',
  },
]

// ── 카피(vi 실발송) — ktc0907b 정직 프레임(공개/비공개) 그대로 ──
const SUBJECT = {
  public: (co, role) => `[FYI] Bạn được chọn vào danh sách đề cử gửi ${co} — ${role}`,
  private: (co, role) => `[FYI] Bạn được chọn vào danh sách đề cử — ${role} tại ${co}`,
}
const HOOK = 'Đội ngũ FYI đã xem xét toàn bộ hồ sơ đã đăng ký và <b>chọn bạn vào danh sách đề cử</b> cho vị trí dưới đây — hồ sơ của bạn phù hợp nhất với yêu cầu của vị trí này.'
const BENEFIT = {
  public: (co) => `<b>Trong tuần này</b>, FYI sẽ gửi danh sách đề cử trực tiếp cho người phụ trách tuyển dụng của ${co}. Hồ sơ của bạn đang ở chế độ công khai nên sẽ được gửi kèm danh sách. Nếu bạn ứng tuyển ngay, CV của bạn sẽ được <b>ưu tiên xem xét</b> cùng lời giới thiệu từ FYI.`,
  private: (co) => `<b>Trong tuần này</b>, FYI sẽ gửi danh sách đề cử trực tiếp cho người phụ trách tuyển dụng của ${co}. Hồ sơ của bạn đang ở chế độ riêng tư — nếu bạn ứng tuyển ngay, CV của bạn sẽ được gửi kèm lời giới thiệu từ FYI và được <b>ưu tiên xem xét</b>.`,
}
const ONETAP = 'Chỉ cần <b>1 chạm</b> — CV đã đăng ký của bạn sẽ được gửi tự động.'

function jobCard(g, job) {
  const logo = job.logo_url
    ? `<img src="${esc(job.logo_url)}" width="44" height="44" alt="" style="width:44px;height:44px;border-radius:10px;object-fit:cover;background:#f0ebe3;display:block">`
    : `<div style="width:44px;height:44px;border-radius:10px;background:#fff0e6;color:#ff6000;font-weight:800;font-size:16px;text-align:center;line-height:44px">${g.initial}</div>`
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #eee5da;border-radius:14px;margin-bottom:8px"><tr>
    <td width="44" style="padding:14px 0 14px 14px;vertical-align:middle">${logo}</td>
    <td style="padding:14px 14px 14px 12px;vertical-align:middle">
      <div style="font-size:12px;color:#8a8073;margin-bottom:3px">${esc(g.company)}</div>
      <div style="font-size:14.5px;font-weight:700;color:#1a1612;line-height:1.35">${esc(job.title.trim())}</div>
      <div style="font-size:12px;color:#b0691a;margin-top:3px">${esc(g.meta)}</div>
    </td>
  </tr></table>`
}

function emailHtml(name, url, unsubUrl, g, job, frame) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1612">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7"><tr><td align="center" style="padding:28px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
  <tr><td style="padding-bottom:18px"><img src="https://salary-fyi.com/fyi-logo.png" height="24" alt="FYI" style="height:24px;width:auto;display:block"></td></tr>
  <tr><td style="font-size:15px;line-height:1.6;color:#1a1612;padding-bottom:6px">Chào ${esc(firstName(name))},</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:14px">${g.intro}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:14px">${HOOK}</td></tr>
  <tr><td style="padding-bottom:10px">${jobCard(g, job)}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-top:4px">${BENEFIT[frame](g.company)} ${ONETAP}</td></tr>
  <tr><td align="center" style="padding:16px 0 6px">
    <a href="${url}" style="display:inline-block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 30px;border-radius:12px">Ứng tuyển 1 chạm →</a>
  </td></tr>
  <tr><td align="center" style="font-size:12.5px;padding-bottom:4px"><a href="${SITE}/ktc/jobs/${job.id}" style="color:#8a8073">Xem mô tả công việc đầy đủ →</a></td></tr>
  <tr><td style="font-size:11.5px;color:#a89f92;text-align:center;line-height:1.5;padding-top:20px">
    Bạn nhận được email này vì đã đăng ký hồ sơ trên FYI.<br>— Đội ngũ FYI · <a href="https://salary-fyi.com/jobs" style="color:#a89f92">salary-fyi.com/jobs</a>
    &nbsp;·&nbsp;<a href="${unsubUrl}" style="color:#a89f92;text-decoration:underline">Hủy đăng ký</a>
  </td></tr>
</table></td></tr></table></body></html>`
}

function emailText(name, url, unsubUrl, g, job, frame) {
  return `Chào ${firstName(name)},

${strip(g.intro)}

${strip(HOOK)}

- ${job.title.trim()} (${g.company}) — ${g.meta} — ${SITE}/ktc/jobs/${job.id}

${strip(BENEFIT[frame](g.company))} ${strip(ONETAP)}

${url}

Bạn nhận được email này vì đã đăng ký hồ sơ trên FYI.
— Đội ngũ FYI · salary-fyi.com/jobs
Hủy đăng ký: ${unsubUrl}`
}

async function main() {
  const { data: jobRows, error: jobErr } = await sb.from('jobs')
    .select('id,title,company,location,logo_url,is_active').in('id', Object.values(JOBS))
  if (jobErr) { console.error(jobErr.message); process.exit(1) }
  const jobById = Object.fromEntries((jobRows || []).map((j) => [j.id, j]))
  for (const [code, id] of Object.entries(JOBS)) {
    if (!jobById[id] || !jobById[id].is_active) { console.error(`공고 없음/비활성: ${code} ${id}`); process.exit(1) }
  }
  const resend = new Resend(env.RESEND_API_KEY)
  const url = (userId, camp, jobId) => `${SITE}/api/resume/recommend?t=${makeToken(userId, camp)}&j=${jobId}`
  const unsubFor = (userId, camp) => `${SITE}/api/coldmail/unsub?t=${makeToken(userId, camp)}`

  const [pool, unsubs, apps, todays] = await Promise.all([
    fetchAll(() => sb.from('user_profiles')
      .select('id,email,full_name,position,desired_roles,yoe_months,location,english_cert,korean_cert,is_resume_public,skills,resume_summary,headline,experiences,university')
      .not('email', 'is', null).not('resume_url', 'is', null).order('created_at', { ascending: false })),
    fetchAll(() => sb.from('events').select('user_id').eq('event', 'coldmail_unsub').not('user_id', 'is', null).order('id')),
    fetchAll(() => sb.from('job_applications').select('user_id,job_id').in('job_id', Object.values(JOBS)).order('id')),
    fetchAll(() => sb.from('job_recommendations').select('user_id,to_email')
      .gte('created_at', new Date().toISOString().slice(0, 10)).order('id')),
  ])
  const unsubSet = new Set(unsubs.map((r) => r.user_id))
  const todayUsers = new Set(todays.map((r) => r.user_id))
  const todayEmails = new Set(todays.map((r) => (r.to_email || '').toLowerCase()).filter(Boolean))
  const appliedByJob = {}
  for (const a of apps) (appliedByJob[a.job_id] ||= new Set()).add(a.user_id)

  // 배정: 다낭 거주 게이트 → GROUPS 순서 = 우선순위, 1인 1그룹. 이메일 중복 프로필은 최신 1건만.
  // 재발송이므로 기추천은 제외하지 않고 기지원만 제외.
  const seen = new Set()
  const assigned = []
  for (const p of pool) {
    if (!p.email || /likelion/i.test(p.email)) continue
    const e = p.email.toLowerCase()
    if (seen.has(e) || unsubSet.has(p.id)) continue
    if (todayUsers.has(p.id) || todayEmails.has(e)) continue
    if (!inDanang(p)) continue
    for (const g of GROUPS) {
      const s = g.pick(p)
      if (s == null) continue
      if ((appliedByJob[JOBS[g.jobKey]] || new Set()).has(p.id)) continue
      assigned.push({ p, s, g, frame: p.is_resume_public ? 'public' : 'private' })
      seen.add(e)
      break
    }
  }

  console.log('발송 대상(다낭 거주 · 1인 1통 배정):')
  for (const g of GROUPS) {
    const rows = assigned.filter((r) => r.g.gkey === g.gkey)
    const pub = rows.filter((x) => x.frame === 'public').length
    console.log(`  ${g.gkey} (${g.label.ko}): ${rows.length}명 (공개 ${pub} / 비공개 ${rows.length - pub})`)
  }
  console.log(`  ── 합계: ${assigned.length}명`)
  if (!doSend) {
    for (const g of GROUPS) {
      const rows = assigned.filter((r) => r.g.gkey === g.gkey).sort((a, b) => b.s - a.s)
      if (!rows.length) continue
      console.log(`\n── ${g.gkey} 상위 5 ──`)
      for (const { p, s, frame } of rows.slice(0, 5))
        console.log(`  [${s}·${frame}] ${p.full_name} <${p.email}> · ${p.position || '?'} · ${Math.round((p.yoe_months || 0) / 12 * 10) / 10}y · ${p.location || '위치?'}`)
    }
    console.log('\n(dry-run — 실발송하려면 --send, 그룹 한정 --group <gkey>)')
    return
  }

  let targets = assigned
  if (onlyGroup) targets = targets.filter((r) => r.g.gkey === onlyGroup)
  if (maxN) targets = targets.slice(0, maxN)
  let ok = 0, fail = 0
  for (const { p, g, frame } of targets) {
    const job = jobById[JOBS[g.jobKey]]
    const camp = `${g.camp}-${frame}`
    const u = url(p.id, camp, job.id), un = unsubFor(p.id, camp)
    const { error } = await resend.emails.send({
      from: RESEND_FROM, to: p.email, subject: SUBJECT[frame](g.company, g.label.vi),
      html: emailHtml(p.full_name, u, un, g, job, frame), text: emailText(p.full_name, u, un, g, job, frame),
      headers: { 'List-Unsubscribe': `<${un}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    })
    if (error) { console.error(`실패 ${p.email}:`, error.message || error); fail++; continue }
    await sb.from('job_recommendations').upsert([{
      user_id: p.id, to_email: p.email, job_id: job.id,
      job_title: job.title, job_company: job.company, sent_by: 'coldmail', kind: 'recommend', status: 'sent',
    }], { onConflict: 'user_id,job_id', ignoreDuplicates: true })
    await sb.from('events').insert([{
      event: 'recommend_sent', page: '/scripts/dn0909-recommend-coldmail',
      meta: { campaign: camp, job_ids: [job.id], frame, group: g.gkey }, user_id: p.id,
    }])
    ok++
    if (ok % 25 === 0) console.log(`  …${ok}/${targets.length}`)
    await sleep(400)
  }
  console.log(`\n✅ 발송 완료: ${ok}/${targets.length} (실패 ${fail})`)
}

main().catch((e) => { console.error(e); process.exit(1) })
