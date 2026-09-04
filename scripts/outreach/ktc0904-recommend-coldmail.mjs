// KTC 라인 9월 초 등록 5개사 종합 추천 콜드메일 — NEXON DEV VINA(V70 QA)·LUEN(R145-147 인턴)·
// Sunjin Vina(V35/V36/V38/V43/V44/V45/V47/V49)·STS(V62)·BlueStar Asia(V64-V67).
// fmc/exporum 패턴: 이력서 보유 풀 → 공고별 룰 캐스케이드(요건 좁은 순) → 1인1통 배정 → 공개/비공개 프레임.
// 산정 실측 9/4: ~710명 (nexon-qa 55 · 콘텐츠 계열 400+ · bluestar-assist 146 · 회계/HR/구매/데이터 각 ≤20).
// 제외: V63 STS 세일즈(JD 본문이 HVAC 내용 — 제목 불일치, 수정 전 보류) · V70에서 8/31 nexon-unity 기수신자(같은 회사 연속 추천 방지).
// V43(가금 마케팅 매니저)은 축산 도메인 요구라 저적합 유의 — JD가 Marketing 전공/경력 허용이라 포함.
//
//   node scripts/outreach/ktc0904-recommend-coldmail.mjs                          # dry-run
//   node scripts/outreach/ktc0904-recommend-coldmail.mjs --send [--group qa] [--max N]
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
  V70: '81fc3d75-a14b-42ee-87de-3bf5a780a8ef', V44: 'ef152ce1-96a9-4ce9-abb2-8fecfc462685',
  V47: '10961f5c-2a85-44c9-9f52-d7771cf6455e', V38: '0abb31f7-f54a-4913-8d60-50f72c843d61',
  V62: '92265f47-ff2c-4fb6-b3f1-a4c085a502d7', V67: 'ae5382ee-97e1-4b2b-9ad7-c52a606c370e',
  V45: '3e206583-4da4-4b5b-b378-1f04e3e51a16', V36: '28f02709-2ab6-4776-9b21-2121b6d92a51',
  V65: '260579df-ce4c-44d0-ab70-592f10ea43df', V49: '23072a24-b564-46fe-ad04-4b3ab70086d6',
  V66: 'dda14cc3-32ac-4c81-96aa-97649f140636', V64: '008df050-ecc6-4958-9c95-59d5f99b012d',
  V43: '8683ca78-7a22-439d-9419-a90e11ca2563', V35: '89ec0c87-5ea3-4c9c-aa90-20347479c122',
  R145: 'c4e49445-ea04-4941-a773-4331d033b9ac', R146: 'c58646d8-aeb0-49d1-a8c0-60884f9a80e7',
  R147: '14849ca1-1e19-4f75-9f03-0f18323c461e',
  V63: '131e7837-3010-417a-af5d-8fa9dbc83d87', // STS 세일즈 — 9/4 KTC 회신으로 보류 해제(JD 기술내용=의도, 기술 아는 세일즈 원함)
  V71: '48353acf-c8f1-45cc-996d-3261712c8d3b', // Sunrise Vina 세일즈 — HCM/하노이/빈즈엉, 하노이 Sales 풀 첫 활용. V72(R&D 화학·하노이)는 풀 0으로 미발송
  V33: '4a0db4d1-a4ba-4fbe-844f-890a5255f101', // 8/31 nexon-unity — V70 제외용(발송 안 함)
}

// ── 대상 선정(룰 기반) ──
const locBucket = (loc) => {
  const s = String(loc || '').toLowerCase()
  if (!s.trim()) return 'B'
  if (/(h[ồo]\s*ch[íi]\s*minh|hcm|sài gòn|sai gon|thủ đức|thu duc|bình dương|binh duong|biên hòa|bien hoa|đồng nai|dong nai)/.test(s)) return 'A'
  return 'X'
}
const inHcmc = (p) => ['A', 'B'].includes(locBucket(p.location))
const inHanoi = (p) => /(hà nội|ha noi|hanoi|\bhn\b)/i.test(String(p.location || ''))
const roles = (p) => new Set([p.position, ...(p.desired_roles || [])].filter(Boolean))
const hasAny = (p, arr) => [...roles(p)].some((r) => arr.includes(r))
const y = (p) => p.yoe_months ?? 0
const locA = (p) => (locBucket(p.location) === 'A' ? 2 : 0)

const GAMEQA = ['Game', 'QA', 'QA Automation']
const DATA = ['Data Analyst', 'Data Scientist', 'Data Engineer', 'BI', 'AI/Data', 'ML Engineer']
const BIZ = ['Business Analyst', 'Business Dev']
const FIN = ['Finance']
const HRR = ['HR']
const PROC = ['Procurement']
const CONTENT = ['Marketing', 'Content', 'Design']
const ASSIST = ['Interpreter', 'Non-IT', 'Operations', 'Operations Executive', 'Admin']
const SALES = ['Sales', 'Business Dev', 'Sales Director', 'Sales Engineer', 'Sales Admin', 'Sales & Business Development Assistant']
// V63 기술 신호 — resume_summary는 세일즈 풀 전원 미파싱(9/4 실측 0/57)이라 skills만 스캔
const TECHSALE = /(hvac|điều hòa|dieu hoa|chiller|cơ khí|co khi|kỹ thuật|ky thuat|electrical|mechanical|thiết bị|thiet bi|máy lạnh|may lanh|điện lạnh|technical|b2b)/i
const techSignal = (p) => TECHSALE.test(JSON.stringify(p.skills || '')) || hasAny(p, ['Sales Engineer'])

// 캐스케이드 순서 = 배정 우선순위(요건 좁은 순), 1인 1그룹.
// 회계(V38→V62→V67)·HR(V45→V36→V65)·구매(V49→V66)는 좁은 요건부터 흘려 3사에 자연 분배.
const GROUPS = [
  {
    gkey: 'qa', brand: 'nexon', jobKey: 'V70', excludeJob: 'V33',
    label: { vi: 'QA Game Tester', ko: 'QA 게임 테스터' },
    pick: (p) => (inHcmc(p) && hasAny(p, GAMEQA) ? locA(p) + (hasAny(p, ['Game']) ? 2 : 0) + (y(p) >= 12 ? 1 : 0) : null),
  },
  {
    gkey: 'data', brand: 'sunjin', jobKey: 'V44',
    label: { vi: 'Trưởng nhóm phân tích dữ liệu', ko: '데이터 분석팀 리드' },
    pick: (p) => (inHcmc(p) && hasAny(p, DATA) && y(p) >= 48 ? locA(p) + (p.english_cert ? 1 : 0) : null),
  },
  {
    gkey: 'invest', brand: 'sunjin', jobKey: 'V47',
    label: { vi: 'Nhân viên nghiên cứu đầu tư', ko: '투자연구·신사업' },
    pick: (p) => (inHcmc(p) && hasAny(p, BIZ) && y(p) >= 24 ? locA(p) + (p.english_cert ? 1 : 0) : null),
  },
  {
    gkey: 'audit', brand: 'sunjin', jobKey: 'V38',
    label: { vi: 'Nhân viên kiểm toán nội bộ', ko: '내부감사' },
    pick: (p) => (inHcmc(p) && hasAny(p, FIN) && y(p) >= 12 && p.english_cert ? locA(p) + (y(p) >= 24 ? 1 : 0) : null),
  },
  {
    gkey: 'acct', brand: 'sts', jobKey: 'V62',
    label: { vi: 'Kế toán Nội bộ', ko: '내부회계' },
    pick: (p) => (inHcmc(p) && hasAny(p, FIN) && y(p) >= 12 ? locA(p) : null),
  },
  {
    gkey: 'acct', brand: 'bluestar', jobKey: 'V67',
    label: { vi: 'Kế toán Công nợ', ko: '채권회계' },
    pick: (p) => (inHcmc(p) && hasAny(p, FIN) ? locA(p) + (y(p) >= 12 ? 1 : 0) : null),
  },
  {
    gkey: 'training', brand: 'sunjin', jobKey: 'V45',
    label: { vi: 'Chuyên viên đào tạo', ko: '교육 담당' },
    pick: (p) => (inHcmc(p) && hasAny(p, HRR) && y(p) >= 24 && p.english_cert ? locA(p) : null),
  },
  {
    gkey: 'recruit', brand: 'sunjin', jobKey: 'V36',
    label: { vi: 'Chuyên viên tuyển dụng', ko: '채용 담당' },
    pick: (p) => (inHcmc(p) && hasAny(p, HRR) && y(p) >= 12 ? locA(p) + (p.english_cert ? 1 : 0) : null),
  },
  {
    gkey: 'hr', brand: 'bluestar', jobKey: 'V65',
    label: { vi: 'Nhân viên Hành chính Nhân sự', ko: 'HR·총무' },
    pick: (p) => (inHcmc(p) && hasAny(p, HRR) ? locA(p) + (y(p) >= 12 ? 1 : 0) : null),
  },
  {
    gkey: 'proc', brand: 'sunjin', jobKey: 'V49',
    label: { vi: 'Chuyên viên Thu mua và Nhập khẩu', ko: '구매·수입' },
    pick: (p) => (inHcmc(p) && hasAny(p, PROC) && y(p) >= 24 ? locA(p) + (p.english_cert ? 1 : 0) : null),
  },
  {
    gkey: 'proc', brand: 'bluestar', jobKey: 'V66',
    label: { vi: 'Nhân viên Thu mua', ko: '구매 담당' },
    pick: (p) => (inHcmc(p) && hasAny(p, PROC) ? locA(p) : null),
  },
  {
    gkey: 'assist', brand: 'bluestar', jobKey: 'V64',
    label: { vi: 'General Director Assistant', ko: '법인장 어시스턴트' },
    pick: (p) => (inHcmc(p) && hasAny(p, ASSIST) && (p.english_cert || p.korean_cert)
      ? locA(p) + (p.korean_cert ? 1 : 0) + (hasAny(p, ['Interpreter']) ? 1 : 0) : null),
  },
  {
    gkey: 'mkt', brand: 'sunjin', jobKey: 'V43',
    label: { vi: 'Quản lý Marketing mảng Gia cầm', ko: '가금 마케팅 매니저' },
    pick: (p) => (inHcmc(p) && hasAny(p, ['Marketing']) && y(p) >= 60 ? locA(p) + (p.english_cert ? 1 : 0) : null),
  },
  {
    gkey: 'media', brand: 'sunjin', jobKey: 'V35',
    label: { vi: 'Nhân viên sản xuất media', ko: '미디어 제작' },
    pick: (p) => (inHcmc(p) && hasAny(p, CONTENT) && y(p) >= 12 && y(p) <= 60 ? locA(p) + (hasAny(p, ['Design']) ? 1 : 0) : null),
  },
  {
    // 9/4 3차: Sunrise Vina 세일즈(V71) — HCM/하노이/빈즈엉 복수 근무지, 하노이 Sales 풀(20명) 첫 활용.
    // 당일 STS 세일즈 기수신 41명은 todays 체크로 자동 제외 — 다음 주 간격 후 재실행하면 그쪽도 흡수됨
    gkey: 'sales', brand: 'sunrise', jobKey: 'V71',
    label: { vi: 'Chuyên viên Sales', ko: 'B2B 세일즈' },
    pick: (p) => ((inHcmc(p) || inHanoi(p)) && hasAny(p, SALES)
      ? (locBucket(p.location) === 'A' || inHanoi(p) ? 2 : 0) + (y(p) >= 12 ? 1 : 0) : null),
  },
  {
    // 9/4 2차: KTC 회신(기술 아는 세일즈 필요·JD 유지)으로 보류 해제 — 기술/B2B 신호 상위 스코어, 카피에 기술 요건 명시
    gkey: 'sales', brand: 'sts', copyKey: 'stssales', jobKey: 'V63',
    label: { vi: 'Sale Thiết Bị Gia Dụng', ko: '가전·설비 세일즈' },
    pick: (p) => (inHcmc(p) && hasAny(p, SALES)
      ? locA(p) + (techSignal(p) ? 3 : 0) + (y(p) >= 24 ? 1 : 0) : null),
  },
  {
    // LUEN 인턴 3공고 — Design→editor(R147), 나머지는 producer/creator 교차 분배
    gkey: 'intern', brand: 'luen', jobKey: null,
    label: { vi: 'Content Intern', ko: '콘텐츠 인턴' },
    pick: (p) => (inHcmc(p) && hasAny(p, CONTENT) && y(p) <= 24 ? locA(p) + (y(p) > 0 ? 1 : 0) : null),
    sub: (p, n) => (hasAny(p, ['Design'])
      ? { jobKey: 'R147', gkey: 'editor', label: { vi: 'Video Editor/Content Marketing Intern', ko: '영상편집 인턴' } }
      : n % 2 === 0
        ? { jobKey: 'R145', gkey: 'producer', label: { vi: 'Content Producer/Biên kịch Intern', ko: '콘텐츠 프로듀서 인턴' } }
        : { jobKey: 'R146', gkey: 'creator', label: { vi: 'AI Content Creator Intern', ko: 'AI 콘텐츠 크리에이터 인턴' } }),
  },
]
const campaignOf = (brand, gkey, frame) => `${brand}-recommend1-${gkey}-${frame}`

// ── 카피(vi 실발송) — kyndof 정직 프레임(공개/비공개), 브랜드별 intro/meta만 갈림 ──
const BRANDS = {
  nexon: {
    company: 'NEXON DEV VINA', initial: 'N', meta: 'Onsite · UOA Tower, TP.HCM',
    intro: '<b>NEXON DEV VINA</b> — studio phát triển game thuộc NEXON, làm việc trên các dự án game toàn cầu — đang tuyển <b>QA Game Tester</b> qua FYI (UOA Tower, TP.HCM). Lưu ý: hãy mô tả kinh nghiệm chơi game và các tựa game bạn đã chơi ngay trong CV.',
  },
  luen: {
    company: 'LUEN', initial: 'L', meta: 'Intern · Trợ cấp 3–4 triệu/tháng',
    intro: '<b>LUEN</b> — startup nội dung Hàn Quốc sản xuất phim ngắn trên YouTube bằng AI tạo sinh — đang tuyển các vị trí <b>Intern</b> về content qua FYI. Không yêu cầu kinh nghiệm; phù hợp với bạn yêu thích sáng tạo nội dung và AI.',
  },
  sunjin: {
    company: 'Sunjin Vina', initial: 'S', meta: 'Onsite · Mai Chí Thọ, TP.HCM',
    intro: '<b>Sunjin Vina</b> — công ty thuộc tập đoàn nông nghiệp – chăn nuôi Sunjin (Hàn Quốc) — đang tuyển nhiều vị trí văn phòng qua FYI, làm việc tại tòa nhà ThiSofic, Mai Chí Thọ, TP.HCM.',
  },
  sts: {
    company: 'STS', initial: 'S', meta: 'Onsite · Quận 7, TP.HCM',
    intro: '<b>STS</b> — doanh nghiệp đang tuyển dụng qua FYI, văn phòng tại Quận 7, TP.HCM.',
  },
  sunrise: {
    company: 'Sunrise Vina', initial: 'S', meta: 'Onsite · TP.HCM / Hà Nội / Bình Dương · 15–20 triệu',
    intro: '<b>Sunrise Vina</b> — doanh nghiệp sản xuất đang tuyển dụng qua FYI — tuyển <b>Chuyên viên Sales</b> (B2B, phụ trách và phát triển thị trường khu vực), làm việc tại TP.HCM / Hà Nội / Bình Dương, mức lương 15–20 triệu.',
  },
  stssales: {
    company: 'STS', initial: 'S', meta: 'Onsite · Quận 7, TP.HCM · Ưu tiên hiểu biết kỹ thuật',
    intro: '<b>STS</b> — doanh nghiệp đang tuyển dụng qua FYI, văn phòng tại Quận 7, TP.HCM — đang tuyển <b>Nhân viên Sales Thiết Bị Gia Dụng</b>. Lưu ý: vị trí này <b>ưu tiên ứng viên Sales có hiểu biết kỹ thuật</b> về thiết bị/hệ thống điều hòa (HVAC) — mô tả công việc bao gồm nhiều nội dung kỹ thuật.',
  },
  bluestar: {
    company: 'BlueStar Asia', initial: 'B', meta: 'Onsite · Bình Lợi Trung, TP.HCM',
    intro: '<b>BlueStar Asia</b> — doanh nghiệp Hàn Quốc trong lĩnh vực dịch vụ suất ăn công nghiệp (F&B) — đang tuyển nhiều vị trí qua FYI, làm việc tại Bình Lợi Trung, TP.HCM.',
  },
}
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

function jobCard(brand, job) {
  const logo = job.logo_url
    ? `<img src="${esc(job.logo_url)}" width="44" height="44" alt="" style="width:44px;height:44px;border-radius:10px;object-fit:cover;background:#f0ebe3;display:block">`
    : `<div style="width:44px;height:44px;border-radius:10px;background:#fff0e6;color:#ff6000;font-weight:800;font-size:16px;text-align:center;line-height:44px">${brand.initial}</div>`
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #eee5da;border-radius:14px;margin-bottom:8px"><tr>
    <td width="44" style="padding:14px 0 14px 14px;vertical-align:middle">${logo}</td>
    <td style="padding:14px 14px 14px 12px;vertical-align:middle">
      <div style="font-size:12px;color:#8a8073;margin-bottom:3px">${esc(brand.company)}</div>
      <div style="font-size:14.5px;font-weight:700;color:#1a1612;line-height:1.35">${esc(job.title.trim())}</div>
      <div style="font-size:12px;color:#b0691a;margin-top:3px">${esc(brand.meta)}</div>
    </td>
  </tr></table>`
}

function emailHtml(name, url, unsubUrl, brand, job, frame) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1612">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7"><tr><td align="center" style="padding:28px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
  <tr><td style="padding-bottom:18px"><img src="https://salary-fyi.com/fyi-logo.png" height="24" alt="FYI" style="height:24px;width:auto;display:block"></td></tr>
  <tr><td style="font-size:15px;line-height:1.6;color:#1a1612;padding-bottom:6px">Chào ${esc(firstName(name))},</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:14px">${brand.intro}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:14px">${HOOK}</td></tr>
  <tr><td style="padding-bottom:10px">${jobCard(brand, job)}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-top:4px">${BENEFIT[frame](brand.company)} ${ONETAP}</td></tr>
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

function emailText(name, url, unsubUrl, brand, job, frame) {
  return `Chào ${firstName(name)},

${strip(brand.intro)}

${strip(HOOK)}

- ${job.title.trim()} (${brand.company}) — ${brand.meta} — ${SITE}/ktc/jobs/${job.id}

${strip(BENEFIT[frame](brand.company))} ${strip(ONETAP)}

${url}

Bạn nhận được email này vì đã đăng ký hồ sơ trên FYI.
— Đội ngũ FYI · salary-fyi.com/jobs
Hủy đăng ký: ${unsubUrl}`
}

async function main() {
  const sendJobIds = Object.entries(JOBS).filter(([k]) => k !== 'V33').map(([, v]) => v)
  const { data: jobRows, error: jobErr } = await sb.from('jobs')
    .select('id,title,company,location,logo_url,is_active').in('id', Object.values(JOBS))
  if (jobErr) { console.error(jobErr.message); process.exit(1) }
  const jobById = Object.fromEntries((jobRows || []).map((j) => [j.id, j]))
  for (const id of sendJobIds) {
    if (!jobById[id] || !jobById[id].is_active) { console.error(`공고 없음/비활성: ${id}`); process.exit(1) }
  }
  const resend = new Resend(env.RESEND_API_KEY)
  const url = (userId, camp, jobId) => `${SITE}/api/resume/recommend?t=${makeToken(userId, camp)}&j=${jobId}`
  const unsubFor = (userId, camp) => `${SITE}/api/coldmail/unsub?t=${makeToken(userId, camp)}`

  const [pool, unsubs, recs, apps, todays] = await Promise.all([
    fetchAll(() => sb.from('user_profiles')
      .select('id,email,full_name,position,desired_roles,yoe_months,location,english_cert,korean_cert,is_resume_public,skills')
      .not('email', 'is', null).not('resume_url', 'is', null).order('created_at', { ascending: false })),
    fetchAll(() => sb.from('events').select('user_id').eq('event', 'coldmail_unsub').not('user_id', 'is', null).order('id')),
    fetchAll(() => sb.from('job_recommendations').select('user_id,job_id').in('job_id', Object.values(JOBS)).order('id')),
    fetchAll(() => sb.from('job_applications').select('user_id,job_id').in('job_id', Object.values(JOBS)).order('id')),
    fetchAll(() => sb.from('job_recommendations').select('user_id,to_email')
      .gte('created_at', new Date().toISOString().slice(0, 10)).order('id')),
  ])
  const unsubSet = new Set(unsubs.map((r) => r.user_id))
  const todayUsers = new Set(todays.map((r) => r.user_id))
  const todayEmails = new Set(todays.map((r) => (r.to_email || '').toLowerCase()).filter(Boolean))
  const recUserByJob = {}, appliedByJob = {}
  for (const r of recs) (recUserByJob[r.job_id] ||= new Set()).add(r.user_id)
  for (const a of apps) (appliedByJob[a.job_id] ||= new Set()).add(a.user_id)
  const recdOrApplied = (jobKey, uid) =>
    (recUserByJob[JOBS[jobKey]] || new Set()).has(uid) || (appliedByJob[JOBS[jobKey]] || new Set()).has(uid)

  // 배정: GROUPS 순서 = 우선순위, 1인 1그룹. luen은 sub()로 3공고 교차 분배.
  const seen = new Set()
  const assigned = []
  let luenN = 0
  for (const p of pool) {
    if (!p.email || /likelion/i.test(p.email)) continue
    const e = p.email.toLowerCase()
    if (seen.has(e) || unsubSet.has(p.id)) continue
    if (todayUsers.has(p.id) || todayEmails.has(e)) continue
    for (const g of GROUPS) {
      if (g.excludeJob && recdOrApplied(g.excludeJob, p.id)) continue
      const s = g.pick(p)
      if (s == null) continue
      let jobKey = g.jobKey, gkey = g.gkey, label = g.label
      if (g.sub) {
        ;({ jobKey, gkey, label } = g.sub(p, luenN))
        if (recdOrApplied('R145', p.id) || recdOrApplied('R146', p.id) || recdOrApplied('R147', p.id)) continue
        luenN++
      } else if (recdOrApplied(jobKey, p.id)) continue
      assigned.push({ p, s, brand: g.brand, copyKey: g.copyKey, gkey, jobKey, label, frame: p.is_resume_public ? 'public' : 'private' })
      seen.add(e)
      break
    }
  }

  const keys = [...new Set(assigned.map((r) => `${r.brand}-${r.gkey}`))]
  console.log('발송 대상(1인 1통 배정):')
  for (const k of keys) {
    const rows = assigned.filter((r) => `${r.brand}-${r.gkey}` === k)
    const pub = rows.filter((x) => x.frame === 'public').length
    console.log(`  ${k} [${rows[0].jobKey}] (${rows[0].label.ko}): ${rows.length}명 (공개 ${pub} / 비공개 ${rows.length - pub})`)
  }
  console.log(`  ── 합계: ${assigned.length}명`)
  if (!doSend) {
    for (const k of keys) {
      const rows = assigned.filter((r) => `${r.brand}-${r.gkey}` === k).sort((a, b) => b.s - a.s)
      console.log(`\n── ${k} 상위 5 ──`)
      for (const { p, s, frame } of rows.slice(0, 5))
        console.log(`  [${s}·${frame}] ${p.full_name} <${p.email}> · ${p.position || '?'} · ${Math.round((p.yoe_months || 0) / 12 * 10) / 10}y · ${p.location || '위치?'}`)
    }
    console.log('\n(dry-run — 실발송하려면 --send, 그룹 한정 --group <gkey>)')
    return
  }

  let targets = assigned
  if (onlyGroup) targets = targets.filter((r) => r.gkey === onlyGroup)
  if (maxN) targets = targets.slice(0, maxN)
  let ok = 0, fail = 0
  for (const { p, frame, brand: bk, copyKey, gkey, jobKey, label } of targets) {
    const brand = BRANDS[copyKey || bk]
    const job = jobById[JOBS[jobKey]]
    const camp = campaignOf(bk, gkey, frame)
    const u = url(p.id, camp, job.id), un = unsubFor(p.id, camp)
    const { error } = await resend.emails.send({
      from: RESEND_FROM, to: p.email, subject: SUBJECT[frame](brand.company, label.vi),
      html: emailHtml(p.full_name, u, un, brand, job, frame), text: emailText(p.full_name, u, un, brand, job, frame),
      headers: { 'List-Unsubscribe': `<${un}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    })
    if (error) { console.error(`실패 ${p.email}:`, error.message || error); fail++; continue }
    await sb.from('job_recommendations').upsert([{
      user_id: p.id, to_email: p.email, job_id: job.id,
      job_title: job.title, job_company: job.company, sent_by: 'coldmail', kind: 'recommend', status: 'sent',
    }], { onConflict: 'user_id,job_id', ignoreDuplicates: true })
    await sb.from('events').insert([{
      event: 'recommend_sent', page: '/scripts/ktc0904-recommend-coldmail',
      meta: { campaign: camp, job_ids: [job.id], frame, group: `${bk}-${gkey}` }, user_id: p.id,
    }])
    ok++
    if (ok % 25 === 0) console.log(`  …${ok}/${targets.length}`)
    await sleep(400)
  }
  console.log(`\n✅ 발송 완료: ${ok}/${targets.length} (실패 ${fail})`)
}

main().catch((e) => { console.error(e); process.exit(1) })
