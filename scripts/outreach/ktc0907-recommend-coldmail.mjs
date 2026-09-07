// KTC 라인 9/7 잔여 풀 종합 추천 콜드메일 — 지원 ≤10 공고 중 룰 확실 그룹만.
// 9/7 풀 점검 실측(잔여=룰적합−기추천−기지원−unsub): SKtax 회계 19 · Sunrise Sales 61 · STS 세일즈 21 ·
// BlueStar HR 26/구매 7/채권회계 20/QA·QC(제조) 18 · Sunjin 채용 14 · Megazone AM 28 · Daehong AD(5y+) ·
// GasDNA 펌웨어 25 · s2e CTV 80 등. 손선별 필요 3건(Overlay 리거·Rothea·Megazone CSA)은 이 웨이브 제외.
// ktc0904b 패턴: 이력서 보유 풀 → 룰 캐스케이드(요건 좁은 순) → 1인1통 배정 → 공개/비공개 프레임.
// 캠페인명: 2차 발송 그룹은 recommend2(신규 수신자, 재발송 아님) · SKtax(9/4 미발송)와 BlueStar QA/QC(신규)는 recommend1.
//
//   node scripts/outreach/ktc0907-recommend-coldmail.mjs                          # dry-run
//   node scripts/outreach/ktc0907-recommend-coldmail.mjs --send [--group acct] [--max N]
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
  V76: '3535bb5a-6a1f-4fc9-a66c-b7dc501ce039', // SKtax 회계 (HCMC An Phú)
  V62: '92265f47-ff2c-4fb6-b3f1-a4c085a502d7', // STS 내부회계
  V67: 'ae5382ee-97e1-4b2b-9ad7-c52a606c370e', // BlueStar 채권회계
  V45: '3e206583-4da4-4b5b-b378-1f04e3e51a16', // Sunjin 교육
  V36: '28f02709-2ab6-4776-9b21-2121b6d92a51', // Sunjin 채용
  V65: '260579df-ce4c-44d0-ab70-592f10ea43df', // BlueStar HR·총무
  V49: '23072a24-b564-46fe-ad04-4b3ab70086d6', // Sunjin 구매·수입
  V66: 'dda14cc3-32ac-4c81-96aa-97649f140636', // BlueStar 구매
  V43: '8683ca78-7a22-439d-9419-a90e11ca2563', // Sunjin 가금 마케팅
  V34: '951d1f55-487c-4e18-abba-e20de274bdc0', // Daehong Art Director
  V69: '0863f6e2-1cae-4f16-b456-bf432fcbd857', // BlueStar QA/QC (제조)
  K20: '44e5a175-df34-4128-8cb2-6d20d716d664', // GasDNA 펌웨어 (한국 E-7)
  V25: '2a01b40f-ab12-45c5-9ed7-868db52507d6', // Megazone Account Manager (하노이)
  V71: '48353acf-c8f1-45cc-996d-3261712c8d3b', // Sunrise Sales (HCM/HN/BD)
  V63: '131e7837-3010-417a-af5d-8fa9dbc83d87', // STS 가전 세일즈
  V32: 'bede6449-7ba8-49f4-83d7-52881c74909d', // FMC Sales Team Leader
  V28: '1079172c-3b4f-4e85-96fa-cd044d7ec0a0', // FMC Account Executive (source_id 미백필 활성 공고)
  R149: '271c6595-052e-437d-ad4c-430bd0b50595', // s2e 파트너 CTV (Remote)
}

// ── 대상 선정(룰 기반, ktc0904 계열과 동일 헬퍼) ──
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
const txt = (p) => (JSON.stringify(p.skills || '') + ' ' + String(p.position || '')).toLowerCase()

const SALES = ['Sales', 'Business Dev', 'Sales Director', 'Sales Engineer', 'Sales Admin', 'Sales & Business Development Assistant']
const FIN = ['Finance']
const HRR = ['HR']
const PROC = ['Procurement']
const DEVISH = ['QA', 'QA Automation', 'Game', 'Backend', 'Frontend', 'Fullstack', 'Mobile', 'Embedded', 'DevOps', 'AI Engineer']
const mfgQcRe = /(chất lượng|chat luong|quality control|iso 9001|haccp|kiểm định|kiem dinh|\bqc\b)/i
const fwRe = /(firmware|embedded|stm32|\bmcu\b|\bpcb\b|altium|rtos|arduino|vi điều khiển)/i

// 캐스케이드 순서 = 배정 우선순위(요건 좁은 순), 1인 1그룹.
// 회계(V76→V62→V67)·HR(V45→V36→V65)·구매(V49→V66)·세일즈(V25→V71→V63→V32→V28→R149)는 좁은 요건부터 자연 분배.
const GROUPS = [
  {
    gkey: 'acct', brand: 'sktax', jobKey: 'V76', camp: 'sktax-recommend1-acct',
    label: { vi: 'Kế toán dịch vụ', ko: '회계 담당자' },
    pick: (p) => (inHcmc(p) && hasAny(p, FIN) && y(p) >= 12 ? locA(p) + (y(p) >= 24 ? 1 : 0) : null),
  },
  {
    gkey: 'acct', brand: 'sts', jobKey: 'V62', camp: 'sts-recommend2-acct',
    label: { vi: 'Kế toán Nội bộ', ko: '내부회계' },
    pick: (p) => (inHcmc(p) && hasAny(p, FIN) && y(p) >= 12 ? locA(p) : null),
  },
  {
    gkey: 'acct', brand: 'bluestar', jobKey: 'V67', camp: 'bluestar-recommend2-acct',
    label: { vi: 'Kế toán Công nợ', ko: '채권회계' },
    pick: (p) => (inHcmc(p) && hasAny(p, FIN) ? locA(p) + (y(p) >= 12 ? 1 : 0) : null),
  },
  {
    gkey: 'training', brand: 'sunjin', jobKey: 'V45', camp: 'sunjin-recommend2-training',
    label: { vi: 'Chuyên viên đào tạo', ko: '교육 담당' },
    pick: (p) => (inHcmc(p) && hasAny(p, HRR) && y(p) >= 24 && p.english_cert ? locA(p) : null),
  },
  {
    gkey: 'recruit', brand: 'sunjin', jobKey: 'V36', camp: 'sunjin-recommend2-recruit',
    label: { vi: 'Chuyên viên tuyển dụng', ko: '채용 담당' },
    pick: (p) => (inHcmc(p) && hasAny(p, HRR) && y(p) >= 12 ? locA(p) + (p.english_cert ? 1 : 0) : null),
  },
  {
    gkey: 'hr', brand: 'bluestar', jobKey: 'V65', camp: 'bluestar-recommend2-hr',
    label: { vi: 'Nhân viên Hành chính Nhân sự', ko: 'HR·총무' },
    pick: (p) => (inHcmc(p) && hasAny(p, HRR) ? locA(p) + (y(p) >= 12 ? 1 : 0) : null),
  },
  {
    gkey: 'proc', brand: 'sunjin', jobKey: 'V49', camp: 'sunjin-recommend2-proc',
    label: { vi: 'Chuyên viên Thu mua và Nhập khẩu', ko: '구매·수입' },
    pick: (p) => (inHcmc(p) && hasAny(p, PROC) && y(p) >= 24 ? locA(p) + (p.english_cert ? 1 : 0) : null),
  },
  {
    gkey: 'proc', brand: 'bluestar', jobKey: 'V66', camp: 'bluestar-recommend2-proc',
    label: { vi: 'Nhân viên Thu mua', ko: '구매 담당' },
    pick: (p) => (inHcmc(p) && hasAny(p, PROC) ? locA(p) : null),
  },
  {
    gkey: 'mkt', brand: 'sunjin', jobKey: 'V43', camp: 'sunjin-recommend2-mkt',
    label: { vi: 'Quản lý Marketing mảng Gia cầm', ko: '가금 마케팅 매니저' },
    pick: (p) => (inHcmc(p) && hasAny(p, ['Marketing']) && y(p) >= 60 ? locA(p) + (p.english_cert ? 1 : 0) : null),
  },
  {
    // 8/31 daehong 원 룰 유지: Design 5y+, 10y+/영어 가점
    gkey: 'ad', brand: 'daehong', jobKey: 'V34', camp: 'daehong-recommend2-ad',
    label: { vi: 'Art Director (Creative Solutions Team)', ko: '아트 디렉터' },
    pick: (p) => (inHcmc(p) && roles(p).has('Design') && y(p) >= 60
      ? locA(p) + (y(p) >= 120 ? 3 : 0) + (p.english_cert ? 2 : 0) : null),
  },
  {
    // 신규 그룹: 제조 QC 신호만(소프트웨어 QA·개발 직군 제외) — 9/7 실측 18명
    gkey: 'qaqc', brand: 'bluestar', jobKey: 'V69', camp: 'bluestar-recommend1-qaqc',
    label: { vi: 'Nhân viên QA/QC', ko: 'QA/QC(제조)' },
    pick: (p) => (inHcmc(p) && !hasAny(p, DEVISH) && mfgQcRe.test(txt(p)) ? locA(p) + (y(p) >= 12 ? 1 : 0) : null),
  },
  {
    // 8/27 손선별 리스트의 하한(1y+)을 룰로 승계 — 주니어(<1y) 제외
    gkey: 'fw', brand: 'gasdna', jobKey: 'K20', camp: 'gasdna-recommend2-fw',
    label: { vi: 'Kỹ sư Firmware & Thiết kế Mạch điện tử', ko: '펌웨어·회로 엔지니어' },
    pick: (p) => ((hasAny(p, ['Embedded']) || fwRe.test(txt(p))) && y(p) >= 12
      ? (hasAny(p, ['Embedded']) ? 2 : 0) + (y(p) >= 24 ? 1 : 0) : null),
  },
  {
    // megazone 원 룰: Sales/BA 3–6y (하노이 가점) — AM 1석
    gkey: 'am', brand: 'megazone', jobKey: 'V25', camp: 'megazone-recommend2-am',
    label: { vi: 'Account Manager', ko: '어카운트 매니저' },
    pick: (p) => ((roles(p).has('Sales') || roles(p).has('Business Analyst') || roles(p).has('BD')) && y(p) >= 36 && y(p) <= 72
      ? (inHanoi(p) ? 3 : 0) + (p.english_cert ? 2 : 0) : null),
  },
  {
    gkey: 'sales', brand: 'sunrise', jobKey: 'V71', camp: 'sunrise-recommend2-sales',
    label: { vi: 'Chuyên viên Sales', ko: 'B2B 세일즈' },
    pick: (p) => ((inHcmc(p) || inHanoi(p)) && hasAny(p, SALES)
      ? (locBucket(p.location) === 'A' || inHanoi(p) ? 2 : 0) + (y(p) >= 12 ? 1 : 0) : null),
  },
  {
    gkey: 'sales', brand: 'sts', copyKey: 'stssales', jobKey: 'V63', camp: 'sts-recommend2-sales',
    label: { vi: 'Sale Thiết Bị Gia Dụng', ko: '가전·설비 세일즈' },
    pick: (p) => (inHcmc(p) && hasAny(p, SALES) ? locA(p) + (y(p) >= 24 ? 1 : 0) : null),
  },
  {
    gkey: 'lead', brand: 'fmc', jobKey: 'V32', camp: 'fmc-recommend2-lead',
    label: { vi: 'Sales Team Leader B2B', ko: 'B2B 세일즈 팀리드' },
    pick: (p) => (inHcmc(p) && hasAny(p, SALES) && y(p) >= 24 && (p.english_cert || p.korean_cert)
      ? locA(p) + (y(p) >= 48 ? 1 : 0) : null),
  },
  {
    gkey: 'ae', brand: 'fmc', jobKey: 'V28', camp: 'fmc-recommend2-ae',
    label: { vi: 'Account Executive', ko: '어카운트 이그제큐티브' },
    pick: (p) => (inHcmc(p) && hasAny(p, SALES) && y(p) >= 12 && y(p) <= 36 ? locA(p) : null),
  },
  {
    gkey: 'partner', brand: 's2e', jobKey: 'R149', camp: 's2e-recommend2-partner',
    label: { vi: 'Cộng tác viên phát triển đối tác', ko: '파트너 개발 협력자' },
    pick: (p) => (hasAny(p, SALES) ? locA(p) + (y(p) >= 12 ? 1 : 0) : null), // Remote CTV — 지역 무관
  },
]

// ── 카피(vi 실발송) — ktc0904 정직 프레임(공개/비공개), 브랜드별 intro/meta만 갈림 ──
const BRANDS = {
  sktax: {
    company: 'SKtax', initial: 'S', meta: 'Onsite · An Phú, TP.HCM · 13–15 triệu',
    intro: '<b>SKtax</b> — công ty dịch vụ kế toán – thuế — đang tuyển <b>Kế toán dịch vụ</b> qua FYI, làm việc tại An Phú, TP.HCM (Thứ 2 – Thứ 6, 8:00–17:00).',
  },
  sts: {
    company: 'STS', initial: 'S', meta: 'Onsite · Quận 7, TP.HCM',
    intro: '<b>STS</b> — doanh nghiệp đang tuyển dụng qua FYI, văn phòng tại Quận 7, TP.HCM.',
  },
  stssales: {
    company: 'STS', initial: 'S', meta: 'Onsite · Quận 7, TP.HCM · Ưu tiên hiểu biết kỹ thuật',
    intro: '<b>STS</b> — doanh nghiệp đang tuyển dụng qua FYI, văn phòng tại Quận 7, TP.HCM — đang tuyển <b>Nhân viên Sales Thiết Bị Gia Dụng</b>. Lưu ý: vị trí này <b>ưu tiên ứng viên Sales có hiểu biết kỹ thuật</b> về thiết bị/hệ thống điều hòa (HVAC) — mô tả công việc bao gồm nhiều nội dung kỹ thuật.',
  },
  bluestar: {
    company: 'BlueStar Asia', initial: 'B', meta: 'Onsite · Bình Lợi Trung, TP.HCM',
    intro: '<b>BlueStar Asia</b> — doanh nghiệp Hàn Quốc trong lĩnh vực dịch vụ suất ăn công nghiệp (F&B) — đang tuyển nhiều vị trí qua FYI, làm việc tại Bình Lợi Trung, TP.HCM.',
  },
  sunjin: {
    company: 'Sunjin Vina', initial: 'S', meta: 'Onsite · Mai Chí Thọ, TP.HCM',
    intro: '<b>Sunjin Vina</b> — công ty thuộc tập đoàn nông nghiệp – chăn nuôi Sunjin (Hàn Quốc) — đang tuyển nhiều vị trí văn phòng qua FYI, làm việc tại tòa nhà ThiSofic, Mai Chí Thọ, TP.HCM.',
  },
  sunrise: {
    company: 'Sunrise Vina', initial: 'S', meta: 'Onsite · TP.HCM / Hà Nội / Bình Dương · 15–20 triệu',
    intro: '<b>Sunrise Vina</b> — doanh nghiệp sản xuất đang tuyển dụng qua FYI — tuyển <b>Chuyên viên Sales</b> (B2B, phụ trách và phát triển thị trường khu vực), làm việc tại TP.HCM / Hà Nội / Bình Dương, mức lương 15–20 triệu.',
  },
  daehong: {
    company: 'DAEHONG COMMUNICATIONS VIETNAM', initial: 'D', meta: 'Onsite · Diamond Plaza, TP.HCM',
    intro: '<b>DAEHONG COMMUNICATIONS VIETNAM</b> — công ty quảng cáo & truyền thông tích hợp thuộc tập đoàn Hàn Quốc — đang tuyển <b>Art Director</b> (Creative Solutions Team) qua FYI, làm việc tại Diamond Plaza, TP.HCM. Vị trí dành cho creative giàu kinh nghiệm, dẫn dắt định hướng hình ảnh cho các chiến dịch thương hiệu lớn; mức lương thỏa thuận theo kinh nghiệm.',
  },
  megazone: {
    company: 'MEGAZONE Vietnam', initial: 'M', meta: 'Hà Nội · 30–39 triệu',
    intro: '<b>MEGAZONE Vietnam</b> — thành viên của MEGAZONE CLOUD, nhà cung cấp dịch vụ quản lý đám mây (MSP) hàng đầu Hàn Quốc và là đối tác cấp cao của AWS — đang tuyển dụng các vị trí chủ chốt cho đội ngũ tại Việt Nam qua FYI (lương 30–39 triệu ₫/tháng, thương lượng theo năng lực).',
  },
  gasdna: {
    company: 'GasDNA', initial: 'G', meta: 'R&D tại Hàn Quốc · Visa E-7',
    intro: '<b>GasDNA</b> — nhà sản xuất máy dò khí (gas detector) hàng đầu Hàn Quốc, thành lập năm 2003 tại Incheon, sản phẩm đạt chứng nhận ISO/CE/ATEX và xuất khẩu tới hơn 20 quốc gia — đang tuyển kỹ sư firmware &amp; mạch điện tử làm việc tại viện R&amp;D ở <b>Hàn Quốc (visa E-7)</b> qua FYI. Không yêu cầu tiếng Hàn; công ty hỗ trợ chi phí về thăm Việt Nam (vé máy bay + lưu trú).',
  },
  fmc: {
    company: 'First Marketing Company', initial: 'F', meta: 'Onsite · Nguyễn Hữu Cảnh, TP.HCM',
    intro: '<b>First Marketing Company</b> — doanh nghiệp Hàn Quốc trong lĩnh vực Digital Marketing, Influencer Marketing và Brand Communication — đang tuyển nhiều vị trí qua FYI, làm việc tại Nguyễn Hữu Cảnh, TP.HCM (môi trường Agency năng động, làm việc trực tiếp với các thương hiệu Hàn Quốc và quốc tế).',
  },
  s2e: {
    company: 's2e', initial: 'S', meta: 'Remote · Freelance/CTV theo dự án POC · 7–9 triệu',
    intro: '<b>s2e</b> — công ty Hàn Quốc trong lĩnh vực thể thao – giáo dục, đang mở rộng thí điểm (POC) ra thị trường Việt Nam — đang tuyển <b>Cộng tác viên phát triển đối tác</b> qua FYI: tìm kiếm và kết nối các học viện thể thao, trung tâm đào tạo hoặc trường học tại địa phương. Làm việc từ xa, hình thức cộng tác viên theo dự án.',
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

  // 배정: GROUPS 순서 = 우선순위, 1인 1그룹. 이메일 중복 프로필은 최신 1건만.
  const seen = new Set()
  const assigned = []
  for (const p of pool) {
    if (!p.email || /likelion/i.test(p.email)) continue
    const e = p.email.toLowerCase()
    if (seen.has(e) || unsubSet.has(p.id)) continue
    if (todayUsers.has(p.id) || todayEmails.has(e)) continue
    for (const g of GROUPS) {
      const s = g.pick(p)
      if (s == null) continue
      if (recdOrApplied(g.jobKey, p.id)) continue
      assigned.push({ p, s, g, frame: p.is_resume_public ? 'public' : 'private' })
      seen.add(e)
      break
    }
  }

  const keys = [...new Set(assigned.map((r) => `${r.g.brand}-${r.g.gkey}`))]
  console.log('발송 대상(1인 1통 배정):')
  for (const k of keys) {
    const rows = assigned.filter((r) => `${r.g.brand}-${r.g.gkey}` === k)
    const pub = rows.filter((x) => x.frame === 'public').length
    console.log(`  ${k} [${rows[0].g.jobKey}] (${rows[0].g.label.ko}): ${rows.length}명 (공개 ${pub} / 비공개 ${rows.length - pub})`)
  }
  console.log(`  ── 합계: ${assigned.length}명`)
  if (!doSend) {
    for (const k of keys) {
      const rows = assigned.filter((r) => `${r.g.brand}-${r.g.gkey}` === k).sort((a, b) => b.s - a.s)
      console.log(`\n── ${k} 상위 5 ──`)
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
    const brand = BRANDS[g.copyKey || g.brand]
    const job = jobById[JOBS[g.jobKey]]
    const camp = `${g.camp}-${frame}`
    const u = url(p.id, camp, job.id), un = unsubFor(p.id, camp)
    const { error } = await resend.emails.send({
      from: RESEND_FROM, to: p.email, subject: SUBJECT[frame](brand.company, g.label.vi),
      html: emailHtml(p.full_name, u, un, brand, job, frame), text: emailText(p.full_name, u, un, brand, job, frame),
      headers: { 'List-Unsubscribe': `<${un}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    })
    if (error) { console.error(`실패 ${p.email}:`, error.message || error); fail++; continue }
    await sb.from('job_recommendations').upsert([{
      user_id: p.id, to_email: p.email, job_id: job.id,
      job_title: job.title, job_company: job.company, sent_by: 'coldmail', kind: 'recommend', status: 'sent',
    }], { onConflict: 'user_id,job_id', ignoreDuplicates: true })
    await sb.from('events').insert([{
      event: 'recommend_sent', page: '/scripts/ktc0907-recommend-coldmail',
      meta: { campaign: camp, job_ids: [job.id], frame, group: `${g.brand}-${g.gkey}` }, user_id: p.id,
    }])
    ok++
    if (ok % 25 === 0) console.log(`  …${ok}/${targets.length}`)
    await sleep(400)
  }
  console.log(`\n✅ 발송 완료: ${ok}/${targets.length} (실패 ${fail})`)
}

main().catch((e) => { console.error(e); process.exit(1) })
