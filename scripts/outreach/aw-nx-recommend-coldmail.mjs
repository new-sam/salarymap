// Andwise(백엔드 시니어)·Nexacode(NX502 B2B 세일즈&마케팅) 지원미달 공고 2건 추천 콜드메일.
// 배경: 8/18 어드민 트래커 기준 둘 다 D+4 지원 0/10. jic-moen 스크립트(8/18)와 동일 패턴.
//   - Andwise Backend Senior Developer — 다낭 온사이트, Java/Spring 3y+·테크리딩 필수, AI/ML 우대. TO 1 간주 → 정예 발송(min 4).
//     ⚠️ jobs.source_id가 null(트래커 표기만 AW802) — zest 전례대로 jobs.id로 직접 참조. 캐시 키는 논리코드 AW802.
//   - NX502 Nexacode B2B Sales & Marketing Executive — 리모트(HCM·HN·ĐN), 경력 무관("B2B에 관심"이면 요건 충족), B2B/콜드메일/CRM/AI툴 우대.
//
// 대상 = 키워드 게이트 × gpt-4o-mini 1~5 채점(--filter, 캐시 data/aw-nx-coldmail-scores.json, 키 "코드:userId").
// 1인 1통: 두 그룹 다 통과 시 고점 그룹, 동점이면 aw1(모수 얇은 쪽·TO 시급) 우선. 프레임·카피는 kyndof 정직 프레임 그대로.
// ⚠️ 카피가 "이번 주 담당자에게 명단 전달"을 약속 — 발송 후 Andwise·Nexacode 측에 추천 명단 실제 공유할 것.
//
//   node scripts/outreach/aw-nx-recommend-coldmail.mjs --filter                 # LLM 채점 캐시 생성(멱등)
//   node scripts/outreach/aw-nx-recommend-coldmail.mjs                          # dry-run: 그룹별 집계
//   node scripts/outreach/aw-nx-recommend-coldmail.mjs --test wsj@likelion.net  # 검수용 한국어 4통(그룹×프레임), 이벤트 기록 없음
//   node scripts/outreach/aw-nx-recommend-coldmail.mjs --send [--max N] [--group aw1]
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { Resend } from 'resend'
import { sb, env, fetchAll, openai } from './lib.mjs'
import { makeToken } from '../../lib/campaignToken.js'

const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d }
const testTo = flag('test', null)
const doSend = args.includes('--send')
const doFilter = args.includes('--filter')
const onlyGroup = flag('group', null)
const maxN = flag('max', null) ? parseInt(flag('max'), 10) : null
// 웨이브2(8/18 팀 결정 "지원 수 늘리기"): --min 2 로 채점 컷 완화(1점=완전 무관만 제외), --wave 2 로 캠페인명 분리
const minOverride = flag('min', null) ? parseInt(flag('min'), 10) : null
const WAVE = flag('wave', null) ? parseInt(flag('wave'), 10) : 1
const SITE = String(flag('site', env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com')).replace(/\/$/, '')
const RESEND_FROM = env.RESEND_FROM || 'FYI <hello@salary-fyi.com>'
const CACHE_FILE = new URL('../../data/aw-nx-coldmail-scores.json', import.meta.url)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const firstName = (n) => String(n || '').trim().split(/\s+/).slice(-1)[0] || 'bạn'

// ── 후보 텍스트/게이트 유틸(jic-moen 채점과 동일 방식) ──
const norm = (v) => (Array.isArray(v) ? v.join(' ') : String(v || ''))
const candText = (p) => {
  const exp = Array.isArray(p.experiences)
    ? p.experiences.map((e) => `${e.title || e.position || ''} ${e.company || ''}`).join(' ')
    : ''
  return [p.position, p.headline, norm(p.desired_roles), norm(p.skills), exp].join(' ').toLowerCase()
}
const posOf = (p) => {
  const s = new Set()
  if (p.position) s.add(String(p.position))
  if (Array.isArray(p.desired_roles)) for (const r of p.desired_roles) s.add(String(r))
  return s
}
const JAVA_RE = /\bjava\b(?!script)|spring boot|spring framework|\bspring\b|hibernate|\bjpa\b/
const SALES_RE = /\bb2b\b|sales|business development|\bbd\b|account (manager|executive)|partnership|kinh doanh|outbound|cold email|lead gen|\bcrm\b|marketing|truyền thông|quảng cáo/

// ── 그룹 정의: 공고 jobs.id·게이트·rubric·카피(회사 소개는 JD 원문에서만, 수치 없음) ──
const GROUPS = [
  {
    key: 'aw1', code: 'AW802', jobId: '3d5e17b3-4219-4f4b-9ece-fe80ff93b758', min: 3, // 3점=비Java 백엔드 포함(유저 결정 8/18)
    label: { vi: 'Backend Senior Developer (Java·Spring)', ko: '백엔드 시니어 개발자 (Java·Spring)' },
    company: 'Andwise',
    locationDisplay: 'Đà Nẵng',
    gate: (p) => (p.yoe_months ?? 0) >= 30 &&
      (JAVA_RE.test(candText(p)) || [...posOf(p)].some((x) => ['Backend', 'Fullstack'].includes(x))),
    rubric: `"Backend Senior Developer (Java·Spring)" 포지션 적합도를 1~5로 채점하라.
공고: Andwise의 시니어 백엔드. 근무지 다낭 온사이트. 필수: Java(v8+)·Spring(Boot/MVC/Data JPA/Security) 백엔드 3년+, RDB(MySQL/PostgreSQL)·ORM(Hibernate), RESTful API 설계, 테크니컬 리더십 또는 프로젝트 리딩 경험. 우대: Python·AI/ML(모델 배포·MLOps), Microservices·Docker·K8s·클라우드(AWS 등)·CI/CD, 프론트엔드 보조 가능.
5=Java/Spring 백엔드 3년+가 명확하고 리딩 또는 AI/ML·인프라 심화 증거 있음, 4=Java/Spring 백엔드 실무가 명확(리딩 증거는 약함), 3=백엔드 개발자지만 Java 중심 아님(Node/PHP/.NET/Go 등), 2=개발자지만 백엔드 아님(프론트/모바일/QA/데이터), 1=비개발자.`,
  },
  {
    key: 'nx1', code: 'NX502', jobId: '2c16fea9-44ce-4a6d-8556-acd28d3a6a3e', min: 3, // 3점=세일즈/마케팅 인접 포함(유저 결정 8/18)
    label: { vi: 'B2B Sales & Marketing Executive', ko: 'B2B 세일즈 & 마케팅 담당자' },
    company: 'Nexacode',
    locationDisplay: 'Remote (HCM · Hà Nội · Đà Nẵng)',
    gate: (p) => SALES_RE.test(candText(p)) || [...posOf(p)].some((x) => ['Sales', 'Marketing'].includes(x)),
    rubric: `"B2B Sales & Marketing Executive" 포지션 적합도를 1~5로 채점하라.
공고: SaaS·ERP·DX 소프트웨어 회사 Nexacode의 B2B 영업·마케팅. 풀리모트. 업무: 잠재 B2B 고객 발굴·리서치, 콜드메일 발송·팔로업, 미팅 조율, 세일즈 파이프라인·고객 데이터 관리, 응답률 분석·메시지 개선, 간단한 마케팅 지원. 요건: B2B 세일즈/마케팅에 대한 관심, 기업 리서치 능력, 뛰어난 문서·이메일 커뮤니케이션, 리모트 자기관리(경력 무관). 우대: B2B/아웃바운드/콜드메일 경험, IT·SaaS·HR 도메인, CRM·Notion·스프레드시트, ChatGPT 등 AI 툴.
5=B2B 세일즈/BD/아웃바운드 실무 경험이 명확, 4=세일즈 또는 마케팅 실무자로 문서 커뮤니케이션·리서치 역량이 뚜렷(B2B 직접 경험은 약함), 3=세일즈/마케팅 인접(CS·오피스·이커머스 운영 등)이고 전환 가능성 있음, 2=직무 무관하나 사무직 배경, 1=무관.`,
  },
]
const campaignOf = (g, frame) => `${g === 'aw1' ? 'andwise' : 'nexacode'}-recommend${WAVE}-${frame}`

// ── 카피 — vi=실발송, ko=검수(--test). kyndof 정직 프레임 재사용, 회사명만 치환 ──
const COPY = {
  subject: {
    public: {
      vi: (g) => `[FYI] Bạn được chọn vào danh sách đề cử gửi ${g.company} — ${g.label.vi}`,
      ko: (g) => `[FYI] ${g.company} 추천 명단에 선정되셨습니다 — ${g.label.ko}`,
    },
    private: {
      vi: (g) => `[FYI] Bạn được chọn vào danh sách đề cử — ${g.label.vi} tại ${g.company}`,
      ko: (g) => `[FYI] 추천 후보 명단에 선정되셨습니다 — ${g.company} ${g.label.ko}`,
    },
  },
  hi: { vi: (n) => `Chào ${n},`, ko: (n) => `${n}님, 안녕하세요.` },
  intro: {
    aw1: {
      vi: '<b>Andwise</b> đang tuyển vị trí <b>Backend Senior Developer</b> làm việc tại <b>Đà Nẵng</b> — vị trí senior yêu cầu tối thiểu 3 năm kinh nghiệm backend <b>Java·Spring</b>, có kinh nghiệm technical leadership / dẫn dắt dự án; kinh nghiệm Python·AI/ML là lợi thế lớn.',
      ko: '<b>Andwise</b>가 <b>다낭</b> 근무 <b>백엔드 시니어 개발자</b>를 채용 중입니다. <b>Java·Spring</b> 백엔드 3년 이상, 테크니컬 리더십/프로젝트 리딩 경험 필수이며 Python·AI/ML 경험은 큰 우대 요소입니다.',
    },
    nx1: {
      vi: '<b>Nexacode</b> — công ty phần mềm xây dựng sản phẩm SaaS, ERP và giải pháp chuyển đổi số — đang tuyển <b>B2B Sales & Marketing Executive</b> làm việc <b>hoàn toàn từ xa (remote)</b>. <b>Không yêu cầu kinh nghiệm</b> — chỉ cần quan tâm đến B2B sales/marketing, có khả năng nghiên cứu doanh nghiệp và giao tiếp tốt qua email·văn bản; kinh nghiệm cold email, CRM hay công cụ AI (ChatGPT, v.v.) là lợi thế.',
      ko: 'SaaS·ERP·DX 소프트웨어 회사 <b>Nexacode</b>가 <b>풀리모트</b> <b>B2B 세일즈 & 마케팅 담당자</b>를 채용 중입니다. <b>경력 무관</b> — B2B 세일즈/마케팅에 대한 관심, 기업 리서치, 이메일·문서 커뮤니케이션이면 충분하고 콜드메일·CRM·AI 툴 경험은 우대입니다.',
    },
  },
  hook: {
    vi: 'Đội ngũ FYI đã xem xét toàn bộ hồ sơ đã đăng ký và <b>chọn bạn vào danh sách đề cử</b> cho vị trí dưới đây — hồ sơ của bạn phù hợp với yêu cầu của vị trí này.',
    ko: 'FYI 팀이 등록된 이력서 전체를 검토해 회원님을 아래 포지션의 <b>추천 명단에 선정</b>했습니다 — 회원님의 이력이 이 포지션 요건에 부합합니다.',
  },
  benefit: {
    public: {
      vi: (c) => `<b>Trong tuần này</b>, FYI sẽ gửi danh sách đề cử trực tiếp cho người phụ trách tuyển dụng của ${c}. Hồ sơ của bạn đang ở chế độ công khai nên sẽ được gửi kèm danh sách. Nếu bạn ứng tuyển ngay, CV của bạn sẽ được <b>ưu tiên xem xét</b> cùng lời giới thiệu từ FYI.`,
      ko: (c) => `<b>이번 주에</b> FYI가 ${c} 채용 담당자에게 추천 명단을 직접 전달합니다. 회원님 이력서는 공개 상태라 명단과 함께 프로필이 전달됩니다. 지금 지원하시면 FYI의 추천과 함께 <b>우선 검토</b>됩니다.`,
    },
    private: {
      vi: (c) => `<b>Trong tuần này</b>, FYI sẽ gửi danh sách đề cử trực tiếp cho người phụ trách tuyển dụng của ${c}. Hồ sơ của bạn đang ở chế độ riêng tư — nếu bạn ứng tuyển ngay, CV của bạn sẽ được gửi kèm lời giới thiệu từ FYI và được <b>ưu tiên xem xét</b>.`,
      ko: (c) => `<b>이번 주에</b> FYI가 ${c} 채용 담당자에게 추천 명단을 직접 전달합니다. 회원님 이력서는 비공개 상태라, 지금 지원하시면 CV가 FYI의 추천과 함께 전달되어 <b>우선 검토</b>됩니다.`,
    },
  },
  onetap: {
    vi: 'Chỉ cần <b>1 chạm</b> — CV đã đăng ký của bạn sẽ được gửi tự động.',
    ko: '<b>원클릭</b>이면 등록된 CV가 자동으로 전달됩니다.',
  },
  cta: { vi: 'Ứng tuyển 1 chạm →', ko: '원클릭 지원하기 →' },
  jdLink: { vi: 'Xem mô tả công việc đầy đủ →', ko: '채용공고 전문 보기 →' },
  footer: { vi: 'Bạn nhận được email này vì đã đăng ký hồ sơ trên FYI.', ko: 'FYI에 이력서를 등록하셔서 이 메일을 받으셨습니다.' },
  unsub: { vi: 'Hủy đăng ký', ko: '수신 거부' },
}
const strip = (s) => String(s).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&')

function jobCard(job, g) {
  const logo = job.logo_url
    ? `<img src="${esc(job.logo_url)}" width="44" height="44" alt="" style="width:44px;height:44px;border-radius:10px;object-fit:cover;background:#f0ebe3;display:block">`
    : `<div style="width:44px;height:44px;border-radius:10px;background:#fff0e6;color:#ff6000;font-weight:800;font-size:16px;text-align:center;line-height:44px">${esc(g.company[0])}</div>`
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #eee5da;border-radius:14px;margin-bottom:8px"><tr>
    <td width="44" style="padding:14px 0 14px 14px;vertical-align:middle">${logo}</td>
    <td style="padding:14px 14px 14px 12px;vertical-align:middle">
      <div style="font-size:12px;color:#8a8073;margin-bottom:3px">${esc(g.company)}</div>
      <div style="font-size:14.5px;font-weight:700;color:#1a1612;line-height:1.35">${esc(job.title.trim())}</div>
      <div style="font-size:12px;color:#b0691a;margin-top:3px">${esc(g.locationDisplay)}</div>
    </td>
  </tr></table>`
}

function emailHtml(name, url, unsubUrl, job, g, frame, lang) {
  const L = (o) => o[lang] || o.vi
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1612">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7"><tr><td align="center" style="padding:28px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
  <tr><td style="padding-bottom:18px"><img src="https://salary-fyi.com/fyi-logo.png" height="24" alt="FYI" style="height:24px;width:auto;display:block"></td></tr>
  <tr><td style="font-size:15px;line-height:1.6;color:#1a1612;padding-bottom:6px">${esc(L(COPY.hi)(firstName(name)))}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:14px">${L(COPY.intro[g.key])}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:14px">${L(COPY.hook)}</td></tr>
  <tr><td style="padding-bottom:10px">${jobCard(job, g)}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-top:4px">${L(COPY.benefit[frame])(g.company)} ${L(COPY.onetap)}</td></tr>
  <tr><td align="center" style="padding:16px 0 6px">
    <a href="${url}" style="display:inline-block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 30px;border-radius:12px">${esc(L(COPY.cta))}</a>
  </td></tr>
  <tr><td align="center" style="font-size:12.5px;padding-bottom:4px"><a href="${SITE}/ktc/jobs/${job.id}" style="color:#8a8073">${esc(L(COPY.jdLink))}</a></td></tr>
  <tr><td style="font-size:11.5px;color:#a89f92;text-align:center;line-height:1.5;padding-top:20px">
    ${esc(L(COPY.footer))}<br>— Đội ngũ FYI · <a href="https://salary-fyi.com/jobs" style="color:#a89f92">salary-fyi.com/jobs</a>
    &nbsp;·&nbsp;<a href="${unsubUrl}" style="color:#a89f92;text-decoration:underline">${esc(L(COPY.unsub))}</a>
  </td></tr>
</table></td></tr></table></body></html>`
}

function emailText(name, url, unsubUrl, job, g, frame, lang) {
  const L = (o) => o[lang] || o.vi
  return `${L(COPY.hi)(firstName(name))}

${strip(L(COPY.intro[g.key]))}

${strip(L(COPY.hook))}

- ${job.title.trim()} (${g.company} · ${g.locationDisplay}) — ${SITE}/ktc/jobs/${job.id}

${strip(L(COPY.benefit[frame])(g.company))} ${strip(L(COPY.onetap))}

${url}

${strip(L(COPY.footer))}
— Đội ngũ FYI · salary-fyi.com/jobs
${strip(L(COPY.unsub))}: ${unsubUrl}`
}

async function main() {
  const resend = new Resend(env.RESEND_API_KEY)
  const jobs = await fetchAll(() => sb.from('jobs')
    .select('id,source_id,title,company,location,logo_url,is_active')
    .in('id', GROUPS.map((g) => g.jobId)).order('id'))
  const jobByCode = Object.fromEntries(GROUPS.map((g) => [g.code, jobs.find((j) => j.id === g.jobId)]))
  for (const g of GROUPS) {
    const j = jobByCode[g.code]
    if (!j) { console.error(`공고 없음: ${g.code} (${g.jobId})`); process.exit(1) }
    if (!j.is_active) console.warn(`⚠️ ${g.code}(${g.company}) is_active=false — 공고목록·원탭 랜딩 비노출 상태. 발송 전 활성화 필요(--send 시 이 그룹 발송 거부).`)
  }

  const url = (userId, campaign, jobId) => `${SITE}/api/resume/recommend?t=${makeToken(userId, campaign)}&j=${jobId}`
  const unsubFor = (userId, campaign) => `${SITE}/api/coldmail/unsub?t=${makeToken(userId, campaign)}`

  // ── 검수용 테스트: 그룹×프레임 한국어 4통, 이벤트 기록 없음 ──
  if (testTo) {
    const { data: rows } = await sb.from('user_profiles').select('id,email,full_name').ilike('email', testTo).limit(1)
    const p = rows?.[0]
    if (!p) { console.error(`계정 없음: ${testTo}`); process.exit(1) }
    for (const g of GROUPS) {
      const job = jobByCode[g.code]
      for (const frame of ['public', 'private']) {
        const camp = campaignOf(g.key, frame)
        const u = url(p.id, camp, job.id), un = unsubFor(p.id, camp)
        const { error } = await resend.emails.send({
          from: RESEND_FROM, to: p.email, subject: COPY.subject[frame].ko(g),
          html: emailHtml(p.full_name, u, un, job, g, frame, 'ko'), text: emailText(p.full_name, u, un, job, g, frame, 'ko'),
          headers: { 'List-Unsubscribe': `<${un}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
        })
        if (error) { console.error(`발송 실패(${g.key}·${frame}):`, error.message || error); process.exit(1) }
        console.log(`✓ 한국어 테스트(${g.key}·${frame}): ${p.email}`)
        await sleep(400)
      }
    }
    console.log('※ 실발송(--send)은 베트남어로 나갑니다. 이 테스트는 events에 기록하지 않습니다.')
    return
  }

  // ── 풀 로드 + 제외(수신거부·기추천·기지원·likelion·이메일 중복·당일 타 캠페인 수신) ──
  const [pool, unsubs, recs, apps, todays] = await Promise.all([
    fetchAll(() => sb.from('user_profiles')
      .select('id,email,full_name,position,headline,skills,desired_roles,yoe_months,experiences,is_resume_public,korean_cert,resume_summary')
      .not('email', 'is', null).not('resume_url', 'is', null)
      .order('created_at', { ascending: false })),
    fetchAll(() => sb.from('events').select('user_id').eq('event', 'coldmail_unsub').not('user_id', 'is', null).order('id')),
    fetchAll(() => sb.from('job_recommendations').select('user_id,job_id,to_email').in('job_id', jobs.map((j) => j.id)).order('id')),
    fetchAll(() => sb.from('job_applications').select('user_id,job_id').in('job_id', jobs.map((j) => j.id)).order('id')),
    // 오늘 이미 어떤 공고든 추천 메일을 받은 사람 — 1인 1통/일 유지(같은 날 여러 회사 "선정" 메일 방지)
    fetchAll(() => sb.from('job_recommendations').select('user_id,to_email')
      .gte('created_at', new Date().toISOString().slice(0, 10)).order('id')),
  ])
  const todayUsers = new Set(todays.map((r) => r.user_id))
  const todayEmails = new Set(todays.map((r) => (r.to_email || '').toLowerCase()).filter(Boolean))
  const unsubSet = new Set(unsubs.map((r) => r.user_id))
  const recUserByJob = {}
  for (const r of recs) (recUserByJob[r.job_id] ||= new Set()).add(r.user_id)
  const recEmails = new Set(recs.map((r) => (r.to_email || '').toLowerCase()).filter(Boolean))
  const appliedByJob = {}
  for (const a of apps) (appliedByJob[a.job_id] ||= new Set()).add(a.user_id)

  const seen = new Set()
  const cohort = pool.filter((p) => {
    if (!p.email || /likelion/i.test(p.email)) return false
    if (unsubSet.has(p.id)) return false
    const e = p.email.toLowerCase()
    if (seen.has(e) || recEmails.has(e)) return false
    if (todayUsers.has(p.id) || todayEmails.has(e)) return false
    seen.add(e)
    return true
  })

  // 그룹별 게이트 통과자(공고별 기추천·기지원 제외 포함)
  const gatedBy = {}
  for (const g of GROUPS) {
    const job = jobByCode[g.code]
    gatedBy[g.key] = cohort.filter((p) => {
      if ((appliedByJob[job.id] || new Set()).has(p.id)) return false
      if ((recUserByJob[job.id] || new Set()).has(p.id)) return false
      return g.gate(p)
    })
  }
  console.log(`게이트 통과: ${GROUPS.map((g) => `${g.key} ${gatedBy[g.key].length}명`).join(' / ')}`)

  // ── --filter: gpt-4o-mini 1~5 채점 → 캐시(멱등) ──
  if (doFilter) {
    const cache = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {}
    let n = 0
    for (const g of GROUPS) {
      for (const p of gatedBy[g.key]) {
        const key = `${g.code}:${p.id}`
        if (cache[key]) continue
        const exps = (Array.isArray(p.experiences) ? p.experiences : []).slice(0, 3)
          .map((e) => `${e.title || e.position || ''} @ ${e.company || ''}: ${String(e.description || '').slice(0, 200)}`)
        const prompt = `아래는 채용 후보의 이력서 요약이다. ${g.rubric}
JSON {"score": n, "why": "한 줄"} 로만 답하라.

position: ${p.position || '?'}
headline: ${p.headline || '?'}
skills: ${(Array.isArray(p.skills) ? p.skills : []).join(', ').slice(0, 300)}
경력 ${p.yoe_months == null ? '?' : Math.round(p.yoe_months / 12 * 10) / 10}년
경력사항: ${exps.join(' | ').slice(0, 600)}
요약: ${JSON.stringify(p.resume_summary || {}).slice(0, 500)}`
        const r = await openai.chat.completions.create({
          model: 'gpt-4o-mini', temperature: 0,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        })
        try { cache[key] = JSON.parse(r.choices[0].message.content) } catch { cache[key] = { score: 0, why: 'parse_error' } }
        n++
        if (n % 25 === 0) { writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 1)); console.log(`  채점 ${n}...`) }
      }
    }
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 1))
    for (const g of GROUPS) {
      const dist = {}
      gatedBy[g.key].forEach((p) => { const s = cache[`${g.code}:${p.id}`]?.score ?? '?'; dist[s] = (dist[s] || 0) + 1 })
      console.log(`✅ ${g.key} 점수 분포:`, dist)
    }
    console.log(`채점 완료(신규 ${n}) → data/aw-nx-coldmail-scores.json`)
    return
  }

  if (!existsSync(CACHE_FILE)) { console.error('채점 캐시 없음 — 먼저 --filter 를 실행할 것'); process.exit(1) }
  const cache = JSON.parse(readFileSync(CACHE_FILE, 'utf8'))

  // ── 1인 1통 배정 — GROUPS 정의 순 순회라 "고점 우선, 동점=먼저 정의된 그룹(aw1)"이 이 조건 하나로 성립 ──
  const assigned = new Map()
  for (const g of GROUPS) {
    for (const p of gatedBy[g.key]) {
      const s = cache[`${g.code}:${p.id}`]?.score ?? 0
      if (s < (minOverride ?? g.min)) continue
      const prev = assigned.get(p.id)
      if (!prev || s > prev.score)
        assigned.set(p.id, { p, g, score: s, gi: GROUPS.indexOf(g), frame: p.is_resume_public ? 'public' : 'private' })
    }
  }

  const list = [...assigned.values()].sort((a, b) => a.gi - b.gi || b.score - a.score)
  console.log(`발송 대상(1인 1통 배정 후): ${list.length}명`)
  for (const g of GROUPS) {
    const rows = list.filter((x) => x.g.key === g.key)
    if (!rows.length) continue
    const pub = rows.filter((x) => x.frame === 'public').length
    console.log(`  ${g.key} (${g.label.ko}, ${minOverride ?? g.min}점+): ${rows.length}명 (공개 ${pub} / 비공개 ${rows.length - pub})`)
  }
  if (!doSend) {
    for (const { p, g, score, frame } of list.slice(0, 40))
      console.log(`  [${score}·${frame}] ${g.key} · ${p.full_name} <${p.email}> · ${Math.round((p.yoe_months || 0) / 12 * 10) / 10}y · ${(p.headline || p.position || '').slice(0, 50)}`)
    if (list.length > 40) console.log(`  … 외 ${list.length - 40}명`)
    console.log('\n(dry-run — 실발송하려면 --send, 그룹 한정은 --group <key>)')
    return
  }

  let targets = onlyGroup ? list.filter((x) => x.g.key === onlyGroup) : list
  targets = targets.filter(({ g }) => {
    if (jobByCode[g.code].is_active) return true
    console.error(`⛔ ${g.key} 발송 건너뜀 — ${g.code} is_active=false (랜딩이 작동하지 않음, 활성화 후 재실행)`)
    return false
  })
  if (maxN) targets = targets.slice(0, maxN)
  let ok = 0, fail = 0
  for (const { p, g, frame } of targets) {
    const job = jobByCode[g.code]
    const camp = campaignOf(g.key, frame)
    const u = url(p.id, camp, job.id), un = unsubFor(p.id, camp)
    const { error } = await resend.emails.send({
      from: RESEND_FROM, to: p.email, subject: COPY.subject[frame].vi(g),
      html: emailHtml(p.full_name, u, un, job, g, frame, 'vi'), text: emailText(p.full_name, u, un, job, g, frame, 'vi'),
      headers: { 'List-Unsubscribe': `<${un}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    })
    if (error) { console.error(`실패 ${p.email}:`, error.message || error); fail++; continue }
    await sb.from('job_recommendations').upsert([{
      user_id: p.id, to_email: p.email, job_id: job.id,
      job_title: job.title, job_company: job.company, sent_by: 'coldmail', kind: 'recommend', status: 'sent',
    }], { onConflict: 'user_id,job_id', ignoreDuplicates: true })
    await sb.from('events').insert([{
      event: 'recommend_sent', page: '/scripts/aw-nx-recommend-coldmail',
      meta: { campaign: camp, job_ids: [job.id], frame, group: g.key }, user_id: p.id,
    }])
    ok++
    if (ok % 25 === 0) console.log(`  …${ok}/${targets.length}`)
    await sleep(400)
  }
  console.log(`\n✅ 발송 완료: ${ok}/${targets.length} (실패 ${fail})`)
}

main().catch((e) => { console.error(e); process.exit(1) })
