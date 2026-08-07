// PRESTO SOLUTION(Software Engineer — Robot & Motion Control) 단일 공고 추천 콜드메일.
// zest-recommend-coldmail.mjs 와 같은 구조·같은 프레임 분리다:
//   공개: "PRESTO 담당자가 당신 이력서를 보고 이 공고를 보냈다 · 지원하면 우선 검토"
//   비공개: "FYI가 전체 이력서를 검토해 추천 후보 명단에 선정 · 이번 주 담당자에게 명단 전달"
//          (⚠️발송 후 실제로 PRESTO 담당자에게 명단을 공유해야 카피가 지켜진다)
//
// 이 공고만의 차이 — 대상 풀이 얇다. C++/C# 보유자는 290명인데 제어·비전·임베디드 문맥까지
// 겹치는 사람은 60명대다. 그래서 "당신 스택이 이 자리와 어디서 만나는지"를 한 문장으로
// 지목하는 HOOK 을 세그먼트별로 갈아끼운다 — 일반 C++/C# 만 보고 보내면 왜 나한테 왔는지가
// 안 읽히고, 이 풀에서는 그게 회신율의 전부다. 세그먼트는 캠페인이 아니라 개인화다
// (수신자가 100명 미만이라 캠페인을 더 쪼개면 어느 쪽이 나은지 셀 수가 없다).
//
//   node scripts/outreach/presto-recommend-coldmail.mjs --test wsj@likelion.net  # 테스트 2통(스탬프 안 함)
//   node scripts/outreach/presto-recommend-coldmail.mjs                          # dry-run: 대상 목록
//   node scripts/outreach/presto-recommend-coldmail.mjs --send [--max N]         # 실발송 + 로깅
//   옵션: --site http://localhost:3000
import { Resend } from 'resend'
import { sb, env, fetchAll } from './lib.mjs'
import { makeToken } from '../../lib/campaignToken.js'

const JOB_ID = '50fa6355-932f-4435-abe9-03aaeb3ec659' // PRESTO SOLUTION — Software Engineer (source='ktc')

const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d }
const testTo = flag('test', null)
const doSend = args.includes('--send')
const CAMPAIGN = { public: 'presto-recommend1-public', private: 'presto-recommend1-private' }
const SITE = String(flag('site', env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com')).replace(/\/$/, '')
const RESEND_FROM = env.RESEND_FROM || 'FYI <hello@salary-fyi.com>'
const maxN = flag('max', null) ? parseInt(flag('max'), 10) : null
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

const JOB_LOCATION_DISPLAY = 'HCM · Đà Nẵng · Hà Nội · Onsite'
const JD_URL = `${SITE}/ktc/jobs/${JOB_ID}` // 전체 JD — CTA(원탭 지원) 아래 보조 링크

// ── JD 매칭 ──────────────────────────────────────────────────────────────
// 게이트는 언어 하나뿐이다: C/C++/C# 중 하나. JD 가 요구한 것도 "개발에 대한 이해"이고
// 경력 1~5년 사원~대리급이라, 제어 실무자만 남기면 대상이 5명으로 끝난다(실측).
// 대신 아래 세그먼트가 순서와 문장을 정한다 — 제어에 가까운 사람부터 나간다.
const hayOf = (p) => [
  ...(Array.isArray(p.skills) ? p.skills : []),
  p.position, p.headline, p.major, p.university,
  JSON.stringify(p.experiences || []),
  JSON.stringify(p.resume_summary || {}),
].map((s) => String(s || '').toLowerCase()).join(' | ')

// 짧은 토큰은 부분일치가 위험하다 — "c" 는 아무 문장에나 들어 있다(lib/jdMatch 와 같은 규칙)
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const hasTok = (hay, t) => (t.length >= 4
  ? hay.includes(t)
  : new RegExp(`(^|[^a-z0-9+#.])${escRe(t)}([^a-z0-9+#.]|$)`).test(hay))
const has = (hay, ...ts) => ts.some((t) => hasTok(hay, t))

/* 세그먼트 — 메일 한 문장이 여기서 갈린다. 위일수록 이 자리에 가깝다.
   판정은 이력서에 실제로 적힌 단어로만 한다(LLM 아님) — 문장이 사실이어야 하므로. */
const SEGMENTS = [
  { key: 'motion', score: 6, keys: ['motion control', 'servo', 'cnc', 'robot', 'robotics', 'scada', 'plc', 'kinematic', 'ethercat'] },
  { key: 'vision', score: 4, keys: ['machine vision', 'opencv', 'halcon', 'image processing', 'computer vision', 'laser', 'yolo'] },
  { key: 'embedded', score: 5, keys: ['embedded', 'firmware', 'stm32', 'rtos', 'microcontroller', 'esp32', 'canoe', 'modbus'] },
  { key: 'gui', score: 5, keys: ['wpf', 'winform', 'windows form', 'devexpress', 'desktop application'] },
  { key: 'major', score: 2, keys: ['mechatronic', 'control engineering', 'automation and control', 'electronic', 'electrical'] },
]

function scoreProfile(p) {
  const hay = hayOf(p)
  /* 게이트는 JD 의 필수요건 그대로 — C/C++ 또는 C#. 단독 'c' 는 안 센다:
     경력·학력 문장 어디에나 낱글자로 걸려서 풀의 3분의 1(580명)이 통과해 버린다. */
  if (!has(hay, 'c++', 'c#', 'c/c++', 'embedded c')) return null
  const y = p.yoe_months
  if (y != null && y > 84) return null // 사원~대리급(JD 1~5년) + 완충 2년
  const seg = SEGMENTS.find((s) => has(hay, ...s.keys)) || { key: 'general', score: 0 }
  let score = seg.score
  if (has(hay, 'python')) score += 2 // 우대: Python 기반 데이터 분석·시각화
  if (y != null && y >= 12 && y <= 60) score += 2 // JD 명시 1~5년
  if (has(hay, 'c++') && has(hay, 'c#')) score += 1 // JD 가 둘 다 적었다
  return { score, seg: seg.key }
}

const firstName = (n) => String(n || '').trim().split(/\s+/).slice(-1)[0] || 'bạn'

// ── 문구 ─────────────────────────────────────────────────────────────────
const SUBJECT = {
  public: '[FYI] PRESTO SOLUTION đã xem hồ sơ của bạn và mời bạn ứng tuyển',
  private: '[FYI] Bạn được chọn vào danh sách đề cử — Software Engineer (Robot & Motion Control)',
}
const INTRO = {
  public: 'Nhà tuyển dụng của <b>PRESTO SOLUTION</b> — công ty Hàn Quốc chuyên giải pháp Motion Control &amp; tự động hóa cho ngành bán dẫn, màn hình và robot công nghiệp — đã xem hồ sơ của bạn trên FYI và <b>gửi cho bạn vị trí này</b>.',
  private: '<b>PRESTO SOLUTION</b> — công ty Hàn Quốc chuyên giải pháp Motion Control &amp; tự động hóa cho ngành bán dẫn, màn hình và robot công nghiệp — đang tuyển Software Engineer qua FYI. Đội ngũ FYI đã xem xét toàn bộ hồ sơ đã đăng ký và <b>chọn bạn vào danh sách đề cử</b> gửi cho nhà tuyển dụng.',
}

/* 왜 당신인지 — 이력서에 실제로 적힌 것만 지목한다. 이 자리는 지원자 대부분이
   "제어 경력자"가 아니라서, 이 한 줄이 없으면 메일이 아무한테나 뿌린 것처럼 읽힌다. */
const HOOK = {
  motion: 'Hồ sơ của bạn có kinh nghiệm với <b>hệ thống điều khiển / robot / PLC</b> — đúng phần lõi của vị trí này.',
  vision: 'Vị trí này phát triển phần mềm điều khiển dựa trên hệ thống <b>Laser &amp; Vision</b>, nên kinh nghiệm <b>xử lý ảnh / Computer Vision</b> của bạn dùng được ngay.',
  embedded: 'Nền tảng <b>C/C++ nhúng</b> của bạn là thứ vị trí này cần để viết phần mềm điều khiển thiết bị.',
  gui: 'Vị trí này viết phần mềm vận hành thiết bị bằng <b>C# (WinForm, WPF)</b> — đúng stack bạn đang làm.',
  major: 'Vị trí này tuyển đúng chuyên ngành của bạn — <b>điện tử · điều khiển · cơ điện tử</b>.',
  general: 'Yêu cầu của vị trí này là <b>hiểu biết về C/C++ hoặc C#</b> — công ty đào tạo phần Motion Control sau khi vào.',
}

const POSITION_LINE = 'Thiết kế phần mềm điều khiển robot công nghiệp bằng Motion Controller, phát triển ứng dụng cho thiết bị và module phân tích dữ liệu điều khiển (ứng dụng AI).'
const REQ_LINE = 'Yêu cầu: hiểu biết <b>C/C++ hoặc C# (WinForm, WPF)</b> · tốt nghiệp Khoa học máy tính / Điện tử / Điều khiển · có thể đi công tác nước ngoài và lái xe. <b>Kinh nghiệm 1–5 năm.</b>'
const BENEFIT_LINE = 'Lương thỏa thuận theo năng lực · hỗ trợ chi phí visa đi Hàn Quốc · thưởng theo kết quả kinh doanh.'

const BENEFIT = {
  public: ' Vì đây là lời mời trực tiếp từ nhà tuyển dụng, hồ sơ của bạn sẽ được <b>ưu tiên xem xét</b> khi ứng tuyển.',
  private: ' <b>Trong tuần này</b>, FYI sẽ gửi danh sách đề cử trực tiếp cho nhà tuyển dụng của PRESTO SOLUTION. Nếu bạn ứng tuyển ngay, CV của bạn sẽ được gửi kèm lời giới thiệu từ FYI và được <b>ưu tiên xem xét</b> so với ứng viên thông thường.',
}

/* ── 한국어 검토판(--lang ko) ──────────────────────────────────────────────
   수신자는 전원 베트남 인재라 실발송은 언제나 베트남어다. 이건 카피를 승인하는 쪽이
   읽으려고 두는 대역판이다(ktc-claim-coldmail.mjs 의 --lang ko 와 같은 용도).
   위 베트남어와 문장이 1:1로 붙어 있어야 한쪽만 고쳐지는 사고가 안 난다 — 고칠 때 같이 고칠 것. */
const KO = {
  SUBJECT: {
    public: '[FYI] PRESTO SOLUTION이 회원님의 이력서를 보고 지원을 제안했습니다',
    private: '[FYI] 추천 후보 명단에 선정되셨습니다 — Software Engineer (Robot & Motion Control)',
  },
  INTRO: {
    public: '반도체·디스플레이·산업용 로봇 분야의 Motion Control 및 자동화 솔루션 기업 <b>PRESTO SOLUTION</b>의 채용 담당자가 FYI에서 회원님의 이력서를 보고 <b>이 포지션을 보내드렸습니다</b>.',
    private: '반도체·디스플레이·산업용 로봇 분야의 Motion Control 및 자동화 솔루션 기업 <b>PRESTO SOLUTION</b>이 FYI를 통해 Software Engineer를 채용합니다. FYI 팀이 등록된 이력서 전체를 검토해 회원님을 <b>추천 후보 명단에 선정</b>했습니다.',
  },
  HOOK: {
    motion: '회원님의 이력서에 <b>제어 시스템 · 로봇 · PLC</b> 경험이 있습니다 — 이 포지션의 핵심입니다.',
    vision: '이 포지션은 <b>레이저 및 비전 시스템</b> 기반 제어 소프트웨어를 개발합니다. 회원님의 <b>영상처리 · 컴퓨터 비전</b> 경험을 바로 쓸 수 있습니다.',
    embedded: '장비 제어 소프트웨어를 쓰는 자리라 회원님의 <b>임베디드 C/C++</b> 기반이 그대로 필요합니다.',
    gui: '이 포지션은 <b>C# (WinForm, WPF)</b>로 장비 운영 프로그램을 만듭니다 — 회원님이 지금 쓰는 스택입니다.',
    major: '이 포지션이 찾는 전공이 회원님의 전공입니다 — <b>전자 · 제어 · 메카트로닉스</b>.',
    general: '이 포지션의 요건은 <b>C/C++ 또는 C#에 대한 이해</b>입니다 — Motion Control은 입사 후 교육합니다.',
  },
  POSITION_LINE: 'Motion Controller를 활용한 산업용 로봇 제어 소프트웨어 설계, 장비 응용 SW 및 제어 데이터 분석 모듈(AI 응용) 개발.',
  REQ_LINE: '자격요건: <b>C/C++ 또는 C# (WinForm, WPF)</b>에 대한 이해 · 컴퓨터공학 / 전자 / 제어 전공 · 해외 출장 및 운전 가능. <b>경력 1~5년.</b>',
  BENEFIT_LINE: '연봉 회사 내규(경력별 상이) · 한국 비자 발급비 지원 · 경영성과급.',
  BENEFIT: {
    public: ' 채용 담당자가 직접 보낸 제안이므로, 지원하시면 이력서가 <b>우선 검토</b>됩니다.',
    private: ' <b>이번 주에</b> FYI가 PRESTO SOLUTION 담당자에게 추천 명단을 직접 전달합니다. 지금 지원하시면 FYI의 추천과 함께 CV가 전달되어 일반 지원자보다 <b>우선 검토</b>됩니다.',
  },
  GREET: (n) => `${n}님, 안녕하세요.`,
  ONE_TAP: ' <b>한 번의 클릭</b>이면 등록된 CV가 자동으로 전달됩니다.',
  CTA: '원클릭 지원하기 →',
  JD_LINK: '채용공고 전문 보기 →',
  FOOTER: 'FYI에 이력서를 등록하셔서 이 메일을 받으셨습니다.',
  UNSUB: '수신 거부',
}
// 언어 선택 — 실발송은 언제나 vi. ko 는 --preview/--test 검토용이다.
const lang = flag('lang', 'vi') === 'ko' ? 'ko' : 'vi'
const VI = {
  SUBJECT, INTRO, HOOK, POSITION_LINE, REQ_LINE, BENEFIT_LINE, BENEFIT,
  GREET: (n) => `Chào ${n},`,
  ONE_TAP: ' ${L.ONE_TAP}',
  CTA: 'Ứng tuyển 1 chạm →',
  JD_LINK: 'Xem mô tả công việc đầy đủ →',
  FOOTER: 'Bạn nhận được email này vì đã đăng ký hồ sơ trên FYI.',
  UNSUB: 'Hủy đăng ký',
}
const L = lang === 'ko' ? KO : VI

// 텍스트판 — HTML 태그만 벗긴다(문장이 갈라지면 두 벌을 따로 고쳐야 해서 사고가 난다)
const plain = (s) => String(s).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')

function emailHtml(name, url, unsubUrl, job, frame, seg) {
  const logo = job.logo_url
    ? `<img src="${esc(job.logo_url)}" width="44" height="44" alt="" style="width:44px;height:44px;border-radius:10px;object-fit:cover;background:#f0ebe3;display:block">`
    : `<div style="width:44px;height:44px;border-radius:10px;background:#fff0e6;color:#ff6000;font-weight:800;font-size:16px;text-align:center;line-height:44px">P</div>`
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1612">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7"><tr><td align="center" style="padding:28px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
  <tr><td style="font-size:20px;font-weight:800;color:#ff6000;padding-bottom:18px">FYI</td></tr>
  <tr><td style="font-size:15px;line-height:1.6;color:#1a1612;padding-bottom:6px">${esc(L.GREET(firstName(name)))}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:14px">${L.INTRO[frame]}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:18px">${L.HOOK[seg]}</td></tr>
  <tr><td style="padding-bottom:14px">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #eee5da;border-radius:14px"><tr>
      <td width="44" style="padding:14px 0 14px 14px;vertical-align:middle">${logo}</td>
      <td style="padding:14px 14px 14px 12px;vertical-align:middle">
        <div style="font-size:12px;color:#8a8073;margin-bottom:3px">${esc(job.company)}</div>
        <div style="font-size:14.5px;font-weight:700;color:#1a1612;line-height:1.35">Software Engineer — Robot &amp; Motion Control</div>
        <div style="font-size:12px;color:#b0691a;margin-top:3px">${esc(JOB_LOCATION_DISPLAY)}</div>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:8px">${L.POSITION_LINE}</td></tr>
  <tr><td style="font-size:13.5px;line-height:1.6;color:#6b6357;padding-bottom:6px">${L.REQ_LINE}<br>${L.BENEFIT_LINE}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-top:10px">
    ${L.BENEFIT[frame]} ${L.ONE_TAP}
  </td></tr>
  <tr><td align="center" style="padding:16px 0 6px">
    <a href="${url}" style="display:inline-block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 30px;border-radius:12px">${esc(L.CTA)}</a>
  </td></tr>
  <tr><td align="center" style="font-size:12.5px;padding-bottom:4px">
    <a href="${JD_URL}" style="color:#8a8073">${esc(L.JD_LINK)}</a>
  </td></tr>
  <tr><td style="font-size:11.5px;color:#a89f92;text-align:center;line-height:1.5;padding-top:20px">
    ${esc(L.FOOTER)}<br>— Đội ngũ FYI · <a href="https://salary-fyi.com/jobs" style="color:#a89f92">salary-fyi.com/jobs</a>
    &nbsp;·&nbsp;<a href="${unsubUrl}" style="color:#a89f92;text-decoration:underline">${esc(L.UNSUB)}</a>
  </td></tr>
</table></td></tr></table></body></html>`
}

function emailText(name, url, unsubUrl, job, frame, seg) {
  return `${L.GREET(firstName(name))}

${plain(L.INTRO[frame])}

${plain(L.HOOK[seg])}

Software Engineer — Robot & Motion Control — ${job.company} (${JOB_LOCATION_DISPLAY})

${plain(L.POSITION_LINE)}
${plain(L.REQ_LINE)}
${plain(L.BENEFIT_LINE)}

${plain(L.BENEFIT[frame])} ${plain(L.ONE_TAP).trim()}

${url}

${plain(L.JD_LINK).replace(' →','')}: ${JD_URL}

— Đội ngũ FYI · salary-fyi.com/jobs
${L.UNSUB}: ${unsubUrl}`
}

async function main() {
  const { data: jobRows } = await sb.from('jobs')
    .select('id,title,company,role,location,logo_url,is_active')
    .eq('id', JOB_ID).limit(1)
  const job = jobRows?.[0]
  if (!job || !job.is_active) { console.error(`공고 없음/비활성: ${JOB_ID}`); process.exit(1) }
  console.log(`공고: ${job.company} — ${job.title.trim()} (${job.id})`)

  // 수신자는 전원 베트남 인재다 — ko 는 검토용 대역판이라 실제로 나가면 안 된다
  if (doSend && lang === 'ko') { console.error('--lang ko 는 검토용입니다. 실발송은 베트남어(기본)로만.'); process.exit(1) }

  const resend = new Resend(env.RESEND_API_KEY)
  const url = (userId, frame) => `${SITE}/api/resume/recommend?t=${makeToken(userId, CAMPAIGN[frame])}&j=${job.id}`
  // 수신거부는 캠페인 무관 전역이다 — 토큰의 campaign 은 어디서 눌렀는지 기록용(pages/api/coldmail/unsub.js)
  const unsubUrl = (userId, frame) => `${SITE}/api/coldmail/unsub?t=${makeToken(userId, CAMPAIGN[frame])}`

  // ── 테스트 모드: 공개/비공개 프레임 각 1통 ──
  if (testTo) {
    const { data: rows } = await sb.from('user_profiles')
      .select('id,email,full_name,position,headline,major,university,skills,yoe_months,experiences,resume_summary').ilike('email', testTo).limit(1)
    const p = rows?.[0]
    if (!p) { console.error(`프로필 없음: ${testTo}`); process.exit(1) }
    const seg = scoreProfile(p)?.seg || 'general' // 매칭 밖이면 기본 문구로 본다
    for (const frame of ['public', 'private']) {
      const u = url(p.id, frame)
      const un = unsubUrl(p.id, frame)
      const { data, error } = await resend.emails.send({
        from: RESEND_FROM, to: p.email, subject: L.SUBJECT[frame],
        text: emailText(p.full_name, u, un, job, frame, seg), html: emailHtml(p.full_name, u, un, job, frame, seg),
        headers: { 'List-Unsubscribe': `<${un}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      })
      if (error) { console.error(`발송 실패(${frame}):`, error); process.exit(1) }
      console.log(`✅ 테스트 발송(${frame}·${seg}):`, data?.id, '\n   랜딩:', u)
      await sleep(400)
    }
    return
  }

  /* ── 미리보기: 프레임 2 × 세그먼트 6 = 12벌을 파일로 뽑는다 ──
     세그먼트마다 문장이 갈리는데 테스트 발송은 한 벌만 보여준다 — 272명에게 나가기 전에
     열두 벌을 다 읽어야 어느 한 벌만 어색한 채로 나가는 일이 없다. */
  if (args.includes('--preview')) {
    const out = flag('out', '/tmp/presto-preview.html')
    const blocks = []
    for (const frame of ['public', 'private']) {
      for (const seg of Object.keys(HOOK)) {
        const body = emailHtml('NGUYEN VAN A', '#', '#', job, frame, seg)
        blocks.push(`<h2 style="font:700 15px sans-serif;padding:10px 16px;margin:0;background:#1a1612;color:#fff">
          ${frame} · ${seg} — ${esc(L.SUBJECT[frame])}</h2>${body}`)
      }
    }
    ;(await import('node:fs')).writeFileSync(out, blocks.join('\n'))
    console.log(`미리보기 ${blocks.length}벌 → ${out}`)
    return
  }

  // ── 제외 셋: 이 공고 기발송·기지원자 ──
  const [recs, apps, unsubs] = await Promise.all([
    fetchAll(() => sb.from('job_recommendations').select('user_id,to_email').eq('job_id', job.id)),
    fetchAll(() => sb.from('job_applications').select('user_id').eq('job_id', job.id)),
    // 수신거부는 캠페인 무관 전역 제외 — 이 공고를 처음 보내는 사람이어도 뺀다
    fetchAll(() => sb.from('events').select('user_id').eq('event', 'coldmail_unsub').not('user_id', 'is', null)),
  ])
  const sentUser = new Set(recs.map((r) => r.user_id).filter(Boolean))
  const sentEmail = new Set(recs.map((r) => (r.to_email || '').toLowerCase()).filter(Boolean))
  const appliedUser = new Set(apps.map((a) => a.user_id).filter(Boolean))
  const unsubUser = new Set(unsubs.map((e) => e.user_id))

  const pool = await fetchAll(() => sb.from('user_profiles')
    .select('id,email,full_name,position,headline,major,university,skills,yoe_months,experiences,resume_summary,resume_url,is_resume_public')
    .not('resume_url', 'is', null))
  const matched = []
  let skippedUnsub = 0
  for (const p of pool) {
    if (!p.resume_url || !p.email || /likelion/i.test(p.email)) continue
    if (sentUser.has(p.id) || sentEmail.has(p.email.toLowerCase()) || appliedUser.has(p.id)) continue
    if (unsubUser.has(p.id)) { skippedUnsub++; continue }
    const m = scoreProfile(p)
    if (!m) continue
    /* 전원 비공개 프레임이다. 공개 프레임("PRESTO 담당자가 당신 이력서를 보고 보냈다")은
       그 열람이 확인되지 않아 쓰지 않는다 — 이력서 공개 여부(is_resume_public)로 가르던
       Zest 방식을 여기서만 접었다. 담당자 열람이 확인되면 아래로 되돌릴 것:
         frame: p.is_resume_public ? 'public' : 'private' */
    matched.push({ p, ...m, frame: 'private' })
  }
  // 제어에 가까운 사람부터. 회신이 붙는 층이 위라, --max 로 잘라도 위부터 남는다.
  matched.sort((a, b) => b.score - a.score)

  const nPub = matched.filter((c) => c.frame === 'public').length
  const tally = {}
  matched.forEach((c) => { tally[c.seg] = (tally[c.seg] || 0) + 1 })
  console.log(`대상: ${matched.length}명 (공개 ${nPub} / 비공개 ${matched.length - nPub}) · 수신거부로 제외 ${skippedUnsub}명`)
  console.log('세그먼트:', tally)
  for (const { p, score, seg, frame } of matched) {
    const y = p.yoe_months
    console.log(`  [${score}·${seg}·${frame === 'public' ? '공개' : '비공개'}] ${p.full_name} <${p.email}> — ${p.position || '?'} · ${y == null ? '경력?' : Math.round(y / 12 * 10) / 10 + 'y'}`)
  }

  if (!doSend) { console.log('\n(dry-run — 실발송하려면 --send)'); return }

  const list = maxN ? matched.slice(0, maxN) : matched
  let ok = 0
  for (const { p, frame, seg } of list) {
    const un = unsubUrl(p.id, frame)
    const { error } = await resend.emails.send({
      from: RESEND_FROM, to: p.email, subject: L.SUBJECT[frame],
      text: emailText(p.full_name, url(p.id, frame), un, job, frame, seg),
      html: emailHtml(p.full_name, url(p.id, frame), un, job, frame, seg),
      headers: { 'List-Unsubscribe': `<${un}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    })
    if (error) { console.error(`실패 ${p.email}:`, error.message || error); continue }
    await sb.from('job_recommendations').upsert([{
      user_id: p.id, to_email: p.email, job_id: job.id,
      job_title: job.title, job_company: job.company, sent_by: 'coldmail', kind: 'recommend', status: 'sent',
    }], { onConflict: 'user_id,job_id', ignoreDuplicates: true })
    await sb.from('events').insert([{
      event: 'recommend_sent', page: '/scripts/presto-recommend-coldmail',
      meta: { campaign: CAMPAIGN[frame], job_ids: [job.id], frame, seg }, user_id: p.id,
    }])
    ok++
    await sleep(400)
  }
  console.log(`✅ 발송 완료: ${ok}/${list.length}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
