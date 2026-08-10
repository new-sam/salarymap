// D+3 지원미달 3공고(PRESTO Sales / LION ROCKET Marketer / PRESTO Motion Control) 추천 콜드메일.
// 대상 산정: 휴리스틱 티어 + gpt-4o-mini 채점 캐시(data/d3-coldmail-filter.json)
//   sales    = 영업 헤드라인 전원 (~75)
//   marketer = A티어(숏폼경험+2y↑) + 채점 4점 + (3점 & 경력 1.5y↑) (~90)
//   motion   = A티어(임베디드/제어/자동화) + B풀 채점 3점↑ (~33)
// 풀이 겹치면 1인 1통 — 풀이 얇은 순(motion > sales > marketer)으로 배정.
// 프레임은 공개/비공개 분리(공개="담당자가 봤다·우선검토", 비공개="추천 명단 선정·이번 주 전달").
// ⚠️비공개 카피가 "이번 주 명단 전달"을 약속하므로 발송 후 실제로 담당자에게 명단을 공유할 것.
//
//   node scripts/outreach/d3-recommend-coldmail.mjs --test wsj@likelion.net  # 검수용 한국어 6통(공고3×프레임2), 이벤트 기록 없음
//   node scripts/outreach/d3-recommend-coldmail.mjs                          # dry-run: 배정 결과
//   node scripts/outreach/d3-recommend-coldmail.mjs --send [--max N]
import { readFileSync } from 'node:fs'
import { Resend } from 'resend'
import { sb, env, fetchAll } from './lib.mjs'
import { makeToken } from '../../lib/campaignToken.js'

const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d }
const testTo = flag('test', null)
const doSend = args.includes('--send')
const SITE = String(flag('site', env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com')).replace(/\/$/, '')
const RESEND_FROM = env.RESEND_FROM || 'FYI <hello@salary-fyi.com>'
const maxN = flag('max', null) ? parseInt(flag('max'), 10) : null
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const firstName = (n) => String(n || '').trim().split(/\s+/).slice(-1)[0] || 'bạn'

const CACHE_FILE = new URL('../../data/d3-coldmail-filter.json', import.meta.url)

// 배정 우선순위 = 이 순서(풀 얇은 순). 카피 수치·조건은 전부 JD에서 온 것만 쓴다.
const JOBS = {
  motion: {
    id: '9f400dbd-c0f9-4d1e-a369-742a8e4c618b',
    campaign: { public: 'presto-motion-recommend1-public', private: 'presto-motion-recommend1-private' },
    initial: 'P',
    subject: {
      public: {
        vi: '[FYI] PRESTO SOLUTION đã xem hồ sơ của bạn — cơ hội làm việc tại Hàn Quốc',
        ko: '[FYI] PRESTO SOLUTION이 회원님의 프로필을 확인했습니다 — 한국 근무 기회',
      },
      private: {
        vi: '[FYI] Bạn được chọn vào danh sách đề cử — Motion Control Engineer tại Hàn Quốc',
        ko: '[FYI] Motion Control Engineer(한국 근무) 추천 명단에 선정되셨습니다',
      },
    },
    intro: {
      public: {
        vi: 'Nhà tuyển dụng của <b>PRESTO SOLUTION</b> — công ty Hàn Quốc chuyên về giải pháp Motion Control và tự động hóa cho ngành bán dẫn, màn hình và robot — đã xem hồ sơ của bạn trên FYI và <b>gửi cho bạn vị trí này</b> vì nền tảng kỹ thuật của bạn phù hợp với yêu cầu.',
        ko: '반도체·디스플레이·로봇용 모션컨트롤/자동화 솔루션 한국 기업 <b>PRESTO SOLUTION</b>의 채용 담당자가 FYI에서 회원님의 프로필을 확인하고, 기술 배경이 요구사항과 맞아 <b>이 포지션을 직접 보냈습니다</b>.',
      },
      private: {
        vi: '<b>PRESTO SOLUTION</b> — công ty Hàn Quốc chuyên về giải pháp Motion Control và tự động hóa cho ngành bán dẫn, màn hình và robot — đang tuyển Motion Control Software Engineer làm việc tại Hàn Quốc qua FYI. Đội ngũ FYI đã xem xét toàn bộ hồ sơ đã đăng ký và <b>chọn bạn vào danh sách đề cử</b> gửi cho nhà tuyển dụng.',
        ko: '반도체·디스플레이·로봇용 모션컨트롤/자동화 솔루션 한국 기업 <b>PRESTO SOLUTION</b>이 FYI를 통해 한국 근무 Motion Control Software Engineer를 채용 중입니다. FYI 팀이 등록된 이력서 전체를 검토해 회원님을 <b>기업에 전달할 추천 명단에 선정</b>했습니다.',
      },
    },
    line1: {
      vi: 'Phát triển và triển khai ứng dụng <b>Laser & Motion Control</b> — lập trình hệ thống điều khiển chuyển động (Servo, EtherCAT, Multi-axis) cho thiết bị tự động hóa.',
      ko: '<b>Laser & Motion Control</b> 애플리케이션 개발 — 자동화 장비의 모션 제어 시스템(Servo·EtherCAT·다축 보간)을 프로그래밍합니다.',
    },
    line2: {
      vi: '<b>Không yêu cầu kinh nghiệm</b> — công ty đào tạo chuyên sâu về Motion Control từ đầu; chỉ cần nền tảng kỹ thuật (tự động hóa, điện – điện tử, cơ điện tử, CNTT) và khả năng đọc tài liệu tiếng Anh. Làm việc <b>onsite tại Hàn Quốc</b>, lương thỏa thuận theo năng lực, hỗ trợ 300.000 điểm PAYCO/tháng.',
      ko: '<b>경력 무관</b> — 모션컨트롤은 입사 후 처음부터 교육하며, 공학 기초(자동화·전기전자·메카트로닉스·CS)와 영어 문서 독해면 충분합니다. <b>한국 온사이트</b>, 급여 협의, 월 PAYCO 30만 포인트 지원.',
    },
    meta: { vi: 'Onsite tại Hàn Quốc · Không yêu cầu kinh nghiệm', ko: '한국 온사이트 · 경력 무관' },
  },
  sales: {
    id: 'cd4fc53e-e9c7-4b31-bc19-6ec3602fc05e',
    campaign: { public: 'presto-sales-recommend1-public', private: 'presto-sales-recommend1-private' },
    initial: 'P',
    subject: {
      public: {
        vi: '[FYI] PRESTO SOLUTION đã xem hồ sơ của bạn và mời bạn ứng tuyển',
        ko: '[FYI] PRESTO SOLUTION이 회원님의 프로필을 보고 지원을 요청했습니다',
      },
      private: {
        vi: '[FYI] Bạn được chọn vào danh sách đề cử cho vị trí Sales Assistant Manager tại PRESTO SOLUTION',
        ko: '[FYI] PRESTO SOLUTION Sales Assistant Manager 추천 명단에 선정되셨습니다',
      },
    },
    intro: {
      public: {
        vi: 'Nhà tuyển dụng của <b>PRESTO SOLUTION</b> — công ty Hàn Quốc chuyên về giải pháp Motion Control và tự động hóa cho ngành bán dẫn, màn hình và robot — đã xem hồ sơ của bạn trên FYI và <b>gửi cho bạn vị trí này</b> vì kinh nghiệm kinh doanh của bạn phù hợp với yêu cầu.',
        ko: '반도체·디스플레이·로봇용 모션컨트롤/자동화 솔루션 한국 기업 <b>PRESTO SOLUTION</b>의 채용 담당자가 FYI에서 회원님의 프로필을 확인하고, 영업 경력이 요구사항과 맞아 <b>이 포지션을 직접 보냈습니다</b>.',
      },
      private: {
        vi: '<b>PRESTO SOLUTION</b> — công ty Hàn Quốc chuyên về giải pháp Motion Control và tự động hóa cho ngành bán dẫn, màn hình và robot — đang tuyển Sales Assistant Manager qua FYI. Đội ngũ FYI đã xem xét toàn bộ hồ sơ đã đăng ký và <b>chọn bạn vào danh sách đề cử</b> gửi cho nhà tuyển dụng.',
        ko: '반도체·디스플레이·로봇용 모션컨트롤/자동화 솔루션 한국 기업 <b>PRESTO SOLUTION</b>이 FYI를 통해 Sales Assistant Manager를 채용 중입니다. FYI 팀이 등록된 이력서 전체를 검토해 회원님을 <b>기업에 전달할 추천 명단에 선정</b>했습니다.',
      },
    },
    line1: {
      vi: 'Phụ trách kinh doanh bộ điều khiển chuyển động <b>ACS</b> và các sản phẩm tự động hóa (Servo, I/O) cho khách hàng trong ngành <b>bán dẫn, màn hình (LCD/OLED), pin và robot</b>.',
      ko: '<b>ACS</b> 모션컨트롤러와 자동화 제품(Servo·I/O)을 <b>반도체·디스플레이(LCD/OLED)·배터리·로봇</b> 고객사에 영업합니다.',
    },
    line2: {
      vi: 'Ưu tiên ứng viên có nền tảng kỹ thuật điện / điện tử / điều khiển / cơ khí hoặc kinh nghiệm bán hàng B2B công nghiệp. Làm việc tại <b>HCM · Đà Nẵng · Hà Nội</b>, lương thỏa thuận theo năng lực, có cơ hội công tác nước ngoài (công ty hỗ trợ chi phí visa đi Hàn Quốc).',
      ko: '전기·전자·제어·기계 배경 또는 산업재 B2B 영업 경험 우대. <b>호치민 · 다낭 · 하노이</b> 근무, 급여 협의, 해외 출장 기회(한국행 비자 비용 지원).',
    },
    meta: { vi: 'HCM · Đà Nẵng · Hà Nội · Lương thỏa thuận', ko: '호치민 · 다낭 · 하노이 · 급여 협의' },
  },
  marketer: {
    id: 'a2ce4b29-6a59-4e5e-9bc6-b4ae94848ccc',
    campaign: { public: 'lionrocket-recommend1-public', private: 'lionrocket-recommend1-private' },
    initial: 'L',
    subject: {
      public: {
        vi: '[FYI] LION ROCKET đã xem hồ sơ của bạn và mời bạn ứng tuyển',
        ko: '[FYI] LION ROCKET이 회원님의 프로필을 보고 지원을 요청했습니다',
      },
      private: {
        vi: '[FYI] Bạn được chọn vào danh sách đề cử cho vị trí Content Marketer tại LION ROCKET',
        ko: '[FYI] LION ROCKET Content Marketer 추천 명단에 선정되셨습니다',
      },
    },
    intro: {
      public: {
        vi: 'Nhà tuyển dụng của <b>LION ROCKET</b> — công ty Hàn Quốc vận hành <b>Tynt</b>, dịch vụ AI trong lĩnh vực Beauty & Wellness với hơn 50.000 người dùng — đã xem hồ sơ của bạn trên FYI và <b>gửi cho bạn vị trí này</b> vì kinh nghiệm content của bạn phù hợp với yêu cầu.',
        ko: '5만+ 유저 AI 뷰티·웰니스 서비스 <b>Tynt</b>를 운영하는 한국 기업 <b>LION ROCKET</b>의 채용 담당자가 FYI에서 회원님의 프로필을 확인하고, 콘텐츠 경력이 요구사항과 맞아 <b>이 포지션을 직접 보냈습니다</b>.',
      },
      private: {
        vi: '<b>LION ROCKET</b> — công ty Hàn Quốc vận hành <b>Tynt</b>, dịch vụ AI trong lĩnh vực Beauty & Wellness với hơn 50.000 người dùng — đang tuyển Content Marketer qua FYI. Đội ngũ FYI đã xem xét toàn bộ hồ sơ đã đăng ký và <b>chọn bạn vào danh sách đề cử</b> gửi cho nhà tuyển dụng.',
        ko: '5만+ 유저 AI 뷰티·웰니스 서비스 <b>Tynt</b>를 운영하는 한국 기업 <b>LION ROCKET</b>이 FYI를 통해 Content Marketer를 채용 중입니다. FYI 팀이 등록된 이력서 전체를 검토해 회원님을 <b>기업에 전달할 추천 명단에 선정</b>했습니다.',
      },
    },
    line1: {
      vi: 'Sáng tạo nội dung quảng cáo — <b>short-form video, hình ảnh, UGC</b> — cho các kênh <b>Meta · TikTok · Instagram</b>, tìm insight và thử nghiệm nhiều format (Before/After, UGC, reaction).',
      ko: '<b>Meta · TikTok · Instagram</b> 광고 콘텐츠(<b>숏폼 영상·이미지·UGC</b>)를 제작하고, 인사이트 발굴과 포맷 실험(Before/After·UGC·리액션)을 진행합니다.',
    },
    line2: {
      vi: 'Theo dõi CPA/ROAS của chính nội dung mình làm và cải thiện dựa trên dữ liệu. Làm việc tại <b>HCM · Đà Nẵng · Hà Nội</b>, lương <b>20–25 triệu</b>.',
      ko: '본인이 만든 콘텐츠의 CPA/ROAS를 직접 보며 데이터 기반으로 개선합니다. <b>호치민 · 다낭 · 하노이</b> 근무, 급여 <b>20–25 triệu</b>.',
    },
    meta: { vi: 'HCM · Đà Nẵng · Hà Nội · 20–25 triệu', ko: '호치민 · 다낭 · 하노이 · 20–25 triệu' },
  },
}

const COPY = {
  benefit: {
    public: {
      vi: 'Vì đây là lời mời trực tiếp từ nhà tuyển dụng, hồ sơ của bạn sẽ được <b>ưu tiên xem xét</b> khi ứng tuyển.',
      ko: '기업 담당자가 직접 보낸 제안이라, 지원 시 <b>우선 검토</b> 대상이 됩니다.',
    },
    private: {
      vi: '<b>Trong tuần này</b>, FYI sẽ gửi danh sách đề cử trực tiếp cho nhà tuyển dụng. Nếu bạn ứng tuyển ngay, CV của bạn sẽ được gửi kèm lời giới thiệu từ FYI và được <b>ưu tiên xem xét</b> so với ứng viên thông thường.',
      ko: '<b>이번 주 안에</b> FYI가 추천 명단을 기업 담당자에게 직접 전달합니다. 지금 지원하시면 FYI의 추천과 함께 CV가 전달되어 일반 지원자보다 <b>우선 검토</b>됩니다.',
    },
  },
  onetap: {
    vi: 'Chỉ cần <b>1 chạm</b> — CV đã đăng ký của bạn sẽ được gửi tự động.',
    ko: '<b>원탭</b>이면 됩니다 — 등록된 CV가 자동으로 전달됩니다.',
  },
  cta: { vi: 'Ứng tuyển 1 chạm →', ko: '원탭 지원 →' },
  hi: { vi: (n) => `Chào ${n},`, ko: (n) => `안녕하세요 ${n}님,` },
  footer: {
    vi: 'Bạn nhận được email này vì đã đăng ký hồ sơ trên FYI.',
    ko: 'FYI에 이력서를 등록하셔서 이 메일을 받으셨습니다.',
  },
  unsub: { vi: 'Hủy nhận email', ko: '수신 거부' },
}

function emailHtml(name, url, unsubUrl, job, cfg, frame, lang) {
  const L = (o) => o[lang] || o.vi
  const logo = job.logo_url
    ? `<img src="${esc(job.logo_url)}" width="44" height="44" alt="" style="width:44px;height:44px;border-radius:10px;object-fit:cover;background:#f0ebe3;display:block">`
    : `<div style="width:44px;height:44px;border-radius:10px;background:#fff0e6;color:#ff6000;font-weight:800;font-size:16px;text-align:center;line-height:44px">${cfg.initial}</div>`
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1612">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7"><tr><td align="center" style="padding:28px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
  <tr><td style="font-size:20px;font-weight:800;color:#ff6000;padding-bottom:18px">FYI</td></tr>
  <tr><td style="font-size:15px;line-height:1.6;color:#1a1612;padding-bottom:6px">${L(COPY.hi)(esc(firstName(name)))}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:18px">${L(cfg.intro[frame])}</td></tr>
  <tr><td style="padding-bottom:14px">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #eee5da;border-radius:14px"><tr>
      <td width="44" style="padding:14px 0 14px 14px;vertical-align:middle">${logo}</td>
      <td style="padding:14px 14px 14px 12px;vertical-align:middle">
        <div style="font-size:12px;color:#8a8073;margin-bottom:3px">${esc(job.company)}</div>
        <div style="font-size:14.5px;font-weight:700;color:#1a1612;line-height:1.35">${esc(job.title)}</div>
        <div style="font-size:12px;color:#b0691a;margin-top:3px">${esc(L(cfg.meta))}</div>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:6px">
    ${L(cfg.line1)}<br><br>${L(cfg.line2)}<br><br>${L(COPY.benefit[frame])} ${L(COPY.onetap)}
  </td></tr>
  <tr><td align="center" style="padding:16px 0 6px">
    <a href="${url}" style="display:inline-block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 30px;border-radius:12px">${L(COPY.cta)}</a>
  </td></tr>
  <tr><td style="font-size:11.5px;color:#a89f92;text-align:center;line-height:1.5;padding-top:20px">
    ${L(COPY.footer)}<br>— Đội ngũ FYI · <a href="https://salary-fyi.com/jobs" style="color:#a89f92">salary-fyi.com/jobs</a>
    &nbsp;·&nbsp;<a href="${unsubUrl}" style="color:#a89f92;text-decoration:underline">${L(COPY.unsub)}</a>
  </td></tr>
</table></td></tr></table></body></html>`
}

const strip = (s) => String(s).replace(/<[^>]+>/g, '')
function emailText(name, url, unsubUrl, job, cfg, frame, lang) {
  const L = (o) => o[lang] || o.vi
  return `${L(COPY.hi)(firstName(name))}

${strip(L(cfg.intro[frame]))}

${job.title} — ${job.company} (${strip(L(cfg.meta))})

${strip(L(cfg.line1))}

${strip(L(cfg.line2))}

${strip(L(COPY.benefit[frame]))} ${strip(L(COPY.onetap))}

${url}

${strip(L(COPY.footer))}
— Đội ngũ FYI · salary-fyi.com/jobs
${strip(L(COPY.unsub))}: ${unsubUrl}`
}

// ── 대상 산정 휴리스틱 (count-targets/refine-b와 동일) ──
const hayOf = (p) => [
  ...(Array.isArray(p.skills) ? p.skills : []),
  p.position, p.headline, p.major, p.university,
  JSON.stringify(p.experiences || []),
  JSON.stringify(p.resume_summary || {}),
].map((s) => String(s || '').toLowerCase()).join(' | ')
const head = (p) => String(p.headline || '').toLowerCase()
const pos = (p) => String(p.position || '').toLowerCase()
const yoe = (p) => (p.yoe_months || 0) / 12

const isMarketer = (p) => /market|content|social|brand|\bpr\b|communication|truyền thông|copywrit|seo|media/i.test(head(p)) || /marketing/.test(pos(p))
const shortFormHit = (p) => /tiktok|short|reels|ugc|video|capcut|meta ads|facebook ads|quảng cáo|performance/i.test(hayOf(p))
const isSalesHead = (p) => /sales|kinh doanh|business development|\bbd\b|account (manager|executive)|thị trường/i.test(head(p)) || pos(p) === 'sales'
const isEngMajor = (p) => /automation|control|mechatronic|electrical|electronic|telecom|computer|software|cơ điện tử|tự động|điện|máy tính|phần mềm|kỹ thuật/i.test(String(p.major || '').toLowerCase())
const notMotionFalse = (p) => !/qa|test|designer|multimedia|analytics|marketing|social/i.test(head(p))
const isEmbedded = (p) => notMotionFalse(p) && (
  /embedded|firmware|\bplc\b|mechatronic|robotic|điều khiển|cơ điện tử|automation engineer|kỹ sư.*tự động|electrical engineer|electronics engineer/i.test(head(p))
  || pos(p) === 'embedded'
  || (/\bc\+\+\b/i.test(head(p)) && isEngMajor(p)))
const isDevPos = (p) => ['fullstack', 'backend', 'frontend', 'devops', 'qa', 'mobile', 'ai/data', 'data', 'it', 'embedded'].includes(pos(p))
  || /\b(developer|engineer|lập trình)\b/i.test(head(p))

async function main() {
  const jobIds = Object.values(JOBS).map((j) => j.id)
  const jobRows = await fetchAll(() => sb.from('jobs').select('id,title,company,logo_url,is_active').in('id', jobIds).order('id'))
  const jobById = Object.fromEntries(jobRows.map((j) => [j.id, j]))
  for (const [key, cfg] of Object.entries(JOBS)) {
    const j = jobById[cfg.id]
    if (!j || !j.is_active) { console.error(`공고 없음/비활성: ${key}`); process.exit(1) }
    console.log(`공고 ${key}: ${j.company} — ${j.title}`)
  }

  const resend = new Resend(env.RESEND_API_KEY)
  const url = (userId, cfg, frame) => `${SITE}/api/resume/recommend?t=${makeToken(userId, cfg.campaign[frame])}&j=${cfg.id}`
  const unsubFor = (userId, cfg, frame) => `${SITE}/api/coldmail/unsub?t=${makeToken(userId, cfg.campaign[frame])}`

  // ── 검수용 테스트: 한국어 6통(공고3 × 프레임2), 이벤트 기록 없음 ──
  if (testTo) {
    const { data: rows } = await sb.from('user_profiles').select('id,email,full_name').ilike('email', testTo).limit(1)
    const p = rows?.[0]
    if (!p) { console.error(`계정 없음: ${testTo}`); process.exit(1) }
    for (const [key, cfg] of Object.entries(JOBS)) {
      for (const frame of ['public', 'private']) {
        const job = jobById[cfg.id]
        const u = url(p.id, cfg, frame), un = unsubFor(p.id, cfg, frame)
        const { error } = await resend.emails.send({
          from: RESEND_FROM, to: p.email, subject: cfg.subject[frame].ko,
          html: emailHtml(p.full_name, u, un, job, cfg, frame, 'ko'), text: emailText(p.full_name, u, un, job, cfg, frame, 'ko'),
          headers: { 'List-Unsubscribe': `<${un}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
        })
        if (error) { console.error(`발송 실패(${key}/${frame}):`, error.message || error); process.exit(1) }
        console.log(`✓ 한국어 테스트(${key}/${frame === 'public' ? '공개' : '비공개'}): ${p.email}`)
        await sleep(400)
      }
    }
    console.log('※ 실발송(--send)은 베트남어로 나갑니다. 이 테스트는 events에 기록하지 않습니다.')
    return
  }

  // ── 제외 셋 ──
  const [recs, apps, unsubs, pool] = await Promise.all([
    fetchAll(() => sb.from('job_recommendations').select('user_id,to_email,job_id').in('job_id', jobIds).order('id')),
    fetchAll(() => sb.from('job_applications').select('user_id,job_id').in('job_id', jobIds).order('id')),
    fetchAll(() => sb.from('events').select('user_id').eq('event', 'coldmail_unsub').not('user_id', 'is', null).order('id')),
    fetchAll(() => sb.from('user_profiles')
      .select('id,email,full_name,position,headline,skills,major,university,yoe_months,experiences,resume_summary,resume_url,is_resume_public,english_cert,korean_cert')
      .not('resume_url', 'is', null).order('id')),
  ])
  const unsubSet = new Set(unsubs.map((r) => r.user_id))
  const exclByJob = {}
  for (const r of [...recs, ...apps]) (exclByJob[r.job_id] ||= new Set()).add(r.user_id)
  const exclEmailByJob = {}
  for (const r of recs) if (r.to_email) (exclEmailByJob[r.job_id] ||= new Set()).add(r.to_email.toLowerCase())

  const verdicts = JSON.parse(readFileSync(CACHE_FILE, 'utf8'))
  const score = (key, p) => verdicts[`${key}:${p.id}`]?.score ?? 0

  // ── 공고별 적격 판정 ──
  const fits = {
    motion: (p) => isEmbedded(p) || (isDevPos(p) && isEngMajor(p) && yoe(p) <= 3 && score('motion', p) >= 3),
    sales: (p) => isSalesHead(p),
    marketer: (p) => isMarketer(p) && !isDevPos(p)
      && ((shortFormHit(p) && yoe(p) >= 2) || score('marketer', p) >= 4 || (score('marketer', p) === 3 && yoe(p) >= 1.5)),
  }

  // ── 1인 1통 배정 — JOBS 정의 순서(motion > sales > marketer)가 우선순위 ──
  const cohort = []
  for (const p of pool) {
    if (!p.email || /likelion/i.test(p.email) || unsubSet.has(p.id)) continue
    for (const [key, cfg] of Object.entries(JOBS)) {
      if (!fits[key](p)) continue
      if (exclByJob[cfg.id]?.has(p.id) || exclEmailByJob[cfg.id]?.has(p.email.toLowerCase())) continue
      cohort.push({ p, key, frame: p.is_resume_public ? 'public' : 'private' })
      break
    }
  }
  cohort.sort((a, b) => (b.p.yoe_months || 0) - (a.p.yoe_months || 0))

  const count = (k, f) => cohort.filter((c) => c.key === k && (!f || c.frame === f)).length
  console.log(`\n대상 ${cohort.length}명 — 1인 1통 배정`)
  for (const k of Object.keys(JOBS)) console.log(`  ${k}: ${count(k)}명 (공개 ${count(k, 'public')} / 비공개 ${count(k, 'private')})`)

  if (!doSend) {
    for (const { p, key, frame } of cohort)
      console.log(`  [${key}·${frame === 'public' ? '공개' : '비공개'}] ${p.full_name} <${p.email}> · ${Math.round(yoe(p) * 10) / 10}y · ${String(p.headline || '').slice(0, 48)}`)
    console.log('\n(dry-run — 실발송하려면 --send)')
    return
  }

  const list = maxN ? cohort.slice(0, maxN) : cohort
  let ok = 0
  const fails = []
  for (const { p, key, frame } of list) {
    const cfg = JOBS[key]
    const job = jobById[cfg.id]
    const u = url(p.id, cfg, frame), un = unsubFor(p.id, cfg, frame)
    const { error } = await resend.emails.send({
      from: RESEND_FROM, to: p.email, subject: cfg.subject[frame].vi,
      html: emailHtml(p.full_name, u, un, job, cfg, frame, 'vi'), text: emailText(p.full_name, u, un, job, cfg, frame, 'vi'),
      headers: { 'List-Unsubscribe': `<${un}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    })
    if (error) { fails.push(p.email); console.error(`실패 ${p.email}:`, error.message || error); continue }
    await sb.from('job_recommendations').upsert([{
      user_id: p.id, to_email: p.email, job_id: cfg.id,
      job_title: job.title, job_company: job.company, sent_by: 'coldmail', kind: 'recommend', status: 'sent',
    }], { onConflict: 'user_id,job_id', ignoreDuplicates: true })
    await sb.from('events').insert([{
      event: 'recommend_sent', page: '/scripts/d3-recommend-coldmail',
      meta: { campaign: cfg.campaign[frame], job_ids: [cfg.id], frame }, user_id: p.id,
    }])
    ok++
    if (ok % 25 === 0) console.log(`  …${ok}/${list.length}`)
    await sleep(400)
  }
  console.log(`\n✅ 발송 완료: ${ok}/${list.length}${fails.length ? ` · 실패 ${fails.length}: ${fails.join(', ')}` : ''}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
