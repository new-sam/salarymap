// KYNDOF·Collective 14개 포지션 추천 콜드메일 — 그룹 통합발송 + 1인 1통 배정 + 공개/비공개 프레임.
// 배경: 킨도프(2000Archives·2000Atelier·Collective 마켓플레이스) 채용 14개 공고(KYN4001~4014, 8/13 업로드).
//
// 대상 = 키워드 프리필터 × gpt-4o-mini 1~5 채점(캐시 data/kyndof-coldmail-scores.json, 채점은
//        별도 세션 스크립트로 완료 — 키 "KYN40xx:userId"). 임계: 01+14 운영 그룹만 3점+, 나머지 4점+.
//        (유저 결정 8/14: 운영은 모수가 얇아 완화, 모수 큰 개발·마케팅·디자인은 고점수만.)
// 1인 1통: 여러 그룹에 걸치면 최고 점수 그룹으로 배정, 동점이면 모수 얇은 그룹 우선(약체 포지션 충원).
// 프레임: is_resume_public 기준 public/private, 캠페인명 분리(zest 표준) — kyndof-<group>1-public/-private.
// 통합그룹은 메일에 공고 카드 2개 + 원탭 버튼 j=id1,id2 (/api/resume/recommend 다중 지원).
// ⚠️ 비공개 카피가 "이번 주 담당자에게 명단 전달"을 약속 — 발송 후 킨도프 측에 추천 명단 실제 공유할 것.
//
//   node scripts/outreach/kyndof-recommend-coldmail.mjs                          # dry-run: 그룹별 집계
//   node scripts/outreach/kyndof-recommend-coldmail.mjs --test wsj@likelion.net  # 검수용 한국어 2통(공개/비공개)
//   node scripts/outreach/kyndof-recommend-coldmail.mjs --send [--max N] [--group tech1]
import { readFileSync, existsSync } from 'node:fs'
import { Resend } from 'resend'
import { sb, env, fetchAll } from './lib.mjs'
import { makeToken } from '../../lib/campaignToken.js'

const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d }
const testTo = flag('test', null)
const doSend = args.includes('--send')
const onlyGroup = flag('group', null)
const maxN = flag('max', null) ? parseInt(flag('max'), 10) : null
// 웨이브2(8/18 팀 결정 "지원 수 늘리기"): --min 2 로 채점 컷 완화(1점=완전 무관만 제외), --wave 2 로 캠페인명 분리
const minOverride = flag('min', null) ? parseInt(flag('min'), 10) : null
const WAVE = flag('wave', null) ? parseInt(flag('wave'), 10) : 1
// --skip KYN4002,KYN4010 — 이미 지원 충족(10+)된 공고 코드 제외(그룹의 나머지 코드만 발송)
const SKIP = new Set(String(flag('skip', '') || '').split(',').map((s) => s.trim()).filter(Boolean))
// --english (웨이브3, 8/20 유저 결정): JD 언어 우대 대응 — 영어 업무소통 가능자(중급+)만 발송
const ENGLISH = args.includes('--english')
// english_cert 자유기입 판독 — 중급+ 하한: Intermediate/B1·B2·C1·C2/IELTS 5.0+/TOEIC 600+/Fluent 등
const englishOk = (c) => {
  const s = String(c || '').toLowerCase()
  if (!s) return false
  if (/pre[- ]?intermediate|elementary|beginner|basic|\ba[12]\b/.test(s)) return false
  if (/fluent|native|advanced|professional|business|upper|intermediate|bilingual|working proficiency|good command|thành thạo|\b[bc][12]\b/.test(s)) return true
  if (/vstep/.test(s) && /[345]/.test(s)) return true // VSTEP 3=B1, 4=B2, 5=C1
  const ielts = s.match(/(\d+(?:\.\d+)?)\s*ielts|ielts[^0-9]{0,25}(\d+(?:\.\d+)?)/)
  if (ielts) return parseFloat(ielts[1] ?? ielts[2]) >= 5
  const toefl = s.match(/toefl[^0-9]{0,15}(\d+)/)
  if (toefl) return parseInt(toefl[1], 10) >= 500
  const toeic = s.match(/toeic[^0-9]{0,15}(\d+)/)
  if (toeic) return parseInt(toeic[1], 10) >= 600
  return false
}
const SITE = String(flag('site', env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com')).replace(/\/$/, '')
const RESEND_FROM = env.RESEND_FROM || 'FYI <hello@salary-fyi.com>'
const CACHE_FILE = new URL('../../data/kyndof-coldmail-scores.json', import.meta.url)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const firstName = (n) => String(n || '').trim().split(/\s+/).slice(-1)[0] || 'bạn'

// ── 채점 스크립트와 동일한 프리필터 정의(변경 금지 — 캐시 키가 이 기준으로 생성됨) ──
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
const POSITIONS = [
  ['KYN4009', 36, ['Backend', 'Fullstack', 'Web'], /back-?end|node\.?js|spring|django|golang|\bphp\b|laravel|\bjava\b(?!script)|\.net|nestjs|fastapi/],
  ['KYN4008', 24, ['Tech Lead', 'Engineering Manager', 'CTO', 'Solutions Architect'], /tech(nical)? lead|team lead|engineering manager|architect|trưởng nhóm/],
  ['KYN4010', 12, ['Frontend', 'Mobile', 'Fullstack'], /react native|flutter|\bios\b|android|front-?end|react|vue/],
  ['KYN4004', 12, ['Data Engineer', 'Data Analyst', 'Data Scientist', 'ML Engineer', 'AI Engineer', 'BI'], /data engineer|etl|airflow|\brpa\b|automation|pandas|power bi|tableau|apps script|zapier|n8n/],
  ['KYN4012', 12, ['Design', 'UX Researcher'], /\bux\b|ui design|product design|figma|thiết kế/],
  ['KYN4003', 12, ['Design'], /graphic|photoshop|illustrator|premiere|after effects|motion|video edit|editor|đồ họa/],
  ['KYN4002', 12, ['Marketing'], /marketing|growth|\bseo\b|content|social media|tiktok|community|truyền thông/],
  ['KYN4013', 36, ['Marketing'], /marketing|growth|\bseo\b|content|social media|tiktok|community|truyền thông/],
  ['KYN4001', 12, ['Operations', 'Sales', 'Merchandiser'], /e-?commerce|shopee|lazada|tiki|tiktok shop|customer (service|support)|cskh|chăm sóc khách hàng|vận hành|operation/],
  ['KYN4014', 24, ['Operations', 'Sales', 'Merchandiser'], /e-?commerce|shopee|lazada|tiki|tiktok shop|customer (service|support)|cskh|chăm sóc khách hàng|vận hành|operation/],
  ['KYN4011', 36, ['PM', 'PO', 'Business Analyst'], /product manager|product owner|business analyst|hoạch định|기획/],
  ['KYN4007', 12, ['Operations', 'Business Analyst'], /research|analyst|operations|assistant|nghiên cứu/],
  ['KYN4005', 12, ['Operations', 'Sales'], /business development|sales|account manager|partnership|kinh doanh|merchandis|fashion|garment|may mặc|project manag/],
  // KYN4006 CLO: 채점 4점+ 0명 — 캠페인 제외(외부 소싱 대상)
]

// ── 발송 그룹: key, 포함 공고 코드, 점수 임계, 그룹 라벨(vi/ko) ──
// scarcity: 동점 배정 시 우선순위(모수 얇은 그룹 먼저) — dry-run 집계 기준 오름차순.
const GROUPS = [
  { key: 'pm1', codes: ['KYN4011'], min: 4, label: { vi: 'Product Manager / Hoạch định Dịch vụ', ko: 'PM/서비스기획' } },
  { key: 'research1', codes: ['KYN4007'], min: 4, label: { vi: 'Associate Nghiên cứu & Vận hành', ko: '리서치·운영 Associate' } },
  { key: 'atelier1', codes: ['KYN4005'], min: 4, label: { vi: 'Vận hành Kinh doanh & Dự án Atelier', ko: 'Atelier 사업·프로젝트 운영' } },
  { key: 'ops1', codes: ['KYN4001', 'KYN4014'], min: 3, label: { vi: 'Vận hành TMĐT & Marketplace', ko: '이커머스·마켓플레이스 운영' } },
  { key: 'data1', codes: ['KYN4004'], min: 4, label: { vi: 'Kỹ sư Tự động hóa & Vận hành Dữ liệu', ko: '자동화·데이터 운영 엔지니어' } },
  { key: 'design1', codes: ['KYN4003', 'KYN4012'], min: 4, label: { vi: 'Graphic Designer / Product Designer UX·UI', ko: '그래픽·프로덕트 디자이너' } },
  { key: 'mobile1', codes: ['KYN4010'], min: 4, label: { vi: 'Kỹ sư Frontend (Ứng dụng Di động)', ko: '프론트엔드(모바일 앱)' } },
  { key: 'growth1', codes: ['KYN4002', 'KYN4013'], min: 4, label: { vi: 'Growth Marketing & Marketplace Marketing', ko: '그로스 마케팅' } },
  { key: 'tech1', codes: ['KYN4008', 'KYN4009'], min: 4, label: { vi: 'Tech Lead / Backend Marketplace', ko: '테크리드·백엔드' } },
]
const campaignOf = (g, frame) => `kyndof${WAVE > 1 ? WAVE : ''}-${g}-${frame}` // 웨이브2부터 kyndof2-* (groupOf는 ^kyndof 매치라 동일 그룹)

// ── 카피 — vi=실발송, ko=검수(--test). 회사 소개는 JD 원문에서만. 수치 없음. ──
// public = 이력서 공개 상태 → 명단과 함께 프로필이 그대로 전달됨을 강조.
// private = 비공개 → 지원해야 CV가 FYI 추천과 함께 전달됨을 강조. (둘 다 "이번 주 명단 전달" 약속 포함)
const COPY = {
  subject: {
    public: {
      vi: (role) => `[FYI] Bạn được chọn vào danh sách đề cử gửi KYNDOF — ${role}`,
      ko: (role) => `[FYI] KYNDOF 추천 명단에 선정되셨습니다 — ${role}`,
    },
    private: {
      vi: (role) => `[FYI] Bạn được chọn vào danh sách đề cử — ${role} tại KYNDOF·Collective`,
      ko: (role) => `[FYI] 추천 후보 명단에 선정되셨습니다 — KYNDOF·Collective ${role}`,
    },
  },
  hi: { vi: (n) => `Chào ${n},`, ko: (n) => `${n}님, 안녕하세요.` },
  intro: {
    vi: '<b>KYNDOF</b> — công ty Hàn Quốc vận hành thương hiệu thời trang <b>2000Archives</b>, tổ chức sản xuất trang phục theo yêu cầu <b>2000Atelier</b> và nền tảng marketplace thời trang C2C <b>Collective</b> — đang tuyển dụng đồng thời nhiều vị trí then chốt qua FYI.',
    ko: '패션 브랜드 <b>2000Archives</b>, 맞춤 제작 <b>2000Atelier</b>, C2C 패션 마켓플레이스 <b>Collective</b>를 운영하는 한국 기업 <b>KYNDOF</b>가 FYI를 통해 주요 포지션을 동시 채용 중입니다.',
  },
  hook: {
    vi: 'Đội ngũ FYI đã xem xét toàn bộ hồ sơ đã đăng ký và <b>chọn bạn vào danh sách đề cử</b> cho vị trí dưới đây — hồ sơ của bạn phù hợp với yêu cầu của vị trí này.',
    ko: 'FYI 팀이 등록된 이력서 전체를 검토해 회원님을 아래 포지션의 <b>추천 명단에 선정</b>했습니다 — 회원님의 이력이 이 포지션 요건에 부합합니다.',
  },
  benefit: {
    public: {
      vi: '<b>Trong tuần này</b>, FYI sẽ gửi danh sách đề cử trực tiếp cho người phụ trách tuyển dụng của KYNDOF. Hồ sơ của bạn đang ở chế độ công khai nên sẽ được gửi kèm danh sách. Nếu bạn ứng tuyển ngay, CV của bạn sẽ được <b>ưu tiên xem xét</b> cùng lời giới thiệu từ FYI.',
      ko: '<b>이번 주에</b> FYI가 킨도프 채용 담당자에게 추천 명단을 직접 전달합니다. 회원님 이력서는 공개 상태라 명단과 함께 프로필이 전달됩니다. 지금 지원하시면 FYI의 추천과 함께 <b>우선 검토</b>됩니다.',
    },
    private: {
      vi: '<b>Trong tuần này</b>, FYI sẽ gửi danh sách đề cử trực tiếp cho người phụ trách tuyển dụng của KYNDOF. Hồ sơ của bạn đang ở chế độ riêng tư — nếu bạn ứng tuyển ngay, CV của bạn sẽ được gửi kèm lời giới thiệu từ FYI và được <b>ưu tiên xem xét</b>.',
      ko: '<b>이번 주에</b> FYI가 킨도프 채용 담당자에게 추천 명단을 직접 전달합니다. 회원님 이력서는 비공개 상태라, 지금 지원하시면 CV가 FYI의 추천과 함께 전달되어 <b>우선 검토</b>됩니다.',
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

function jobCard(job) {
  const logo = job.logo_url
    ? `<img src="${esc(job.logo_url)}" width="44" height="44" alt="" style="width:44px;height:44px;border-radius:10px;object-fit:cover;background:#f0ebe3;display:block">`
    : `<div style="width:44px;height:44px;border-radius:10px;background:#fff0e6;color:#ff6000;font-weight:800;font-size:16px;text-align:center;line-height:44px">K</div>`
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #eee5da;border-radius:14px;margin-bottom:8px"><tr>
    <td width="44" style="padding:14px 0 14px 14px;vertical-align:middle">${logo}</td>
    <td style="padding:14px 14px 14px 12px;vertical-align:middle">
      <div style="font-size:12px;color:#8a8073;margin-bottom:3px">KYNDOF · Collective</div>
      <div style="font-size:14.5px;font-weight:700;color:#1a1612;line-height:1.35">${esc(job.title.trim())}</div>
      <div style="font-size:12px;color:#b0691a;margin-top:3px">${esc(job.location || '')}</div>
    </td>
  </tr></table>`
}

function emailHtml(name, url, unsubUrl, jobs, frame, lang) {
  const L = (o) => o[lang] || o.vi
  const jdLinks = jobs.map((j) => `<a href="${SITE}/ktc/jobs/${j.id}" style="color:#8a8073">${esc(L(COPY.jdLink))}</a>`).join(' &nbsp;·&nbsp; ')
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1612">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7"><tr><td align="center" style="padding:28px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
  <tr><td style="padding-bottom:18px"><img src="https://salary-fyi.com/fyi-logo.png" height="24" alt="FYI" style="height:24px;width:auto;display:block"></td></tr>
  <tr><td style="font-size:15px;line-height:1.6;color:#1a1612;padding-bottom:6px">${esc(L(COPY.hi)(firstName(name)))}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:14px">${L(COPY.intro)}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:14px">${L(COPY.hook)}</td></tr>
  <tr><td style="padding-bottom:10px">${jobs.map(jobCard).join('')}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-top:4px">${L(COPY.benefit[frame])} ${L(COPY.onetap)}</td></tr>
  <tr><td align="center" style="padding:16px 0 6px">
    <a href="${url}" style="display:inline-block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 30px;border-radius:12px">${esc(L(COPY.cta))}</a>
  </td></tr>
  <tr><td align="center" style="font-size:12.5px;padding-bottom:4px">${jdLinks}</td></tr>
  <tr><td style="font-size:11.5px;color:#a89f92;text-align:center;line-height:1.5;padding-top:20px">
    ${esc(L(COPY.footer))}<br>— Đội ngũ FYI · <a href="https://salary-fyi.com/jobs" style="color:#a89f92">salary-fyi.com/jobs</a>
    &nbsp;·&nbsp;<a href="${unsubUrl}" style="color:#a89f92;text-decoration:underline">${esc(L(COPY.unsub))}</a>
  </td></tr>
</table></td></tr></table></body></html>`
}

function emailText(name, url, unsubUrl, jobs, frame, lang) {
  const L = (o) => o[lang] || o.vi
  return `${L(COPY.hi)(firstName(name))}

${strip(L(COPY.intro))}

${strip(L(COPY.hook))}

${jobs.map((j) => `- ${j.title.trim()} (KYNDOF · Collective) — ${SITE}/ktc/jobs/${j.id}`).join('\n')}

${strip(L(COPY.benefit[frame]))} ${strip(L(COPY.onetap))}

${url}

${strip(L(COPY.footer))}
— Đội ngũ FYI · salary-fyi.com/jobs
${strip(L(COPY.unsub))}: ${unsubUrl}`
}

async function main() {
  if (!existsSync(CACHE_FILE)) { console.error('채점 캐시 없음: data/kyndof-coldmail-scores.json'); process.exit(1) }
  const cache = JSON.parse(readFileSync(CACHE_FILE, 'utf8'))
  const resend = new Resend(env.RESEND_API_KEY)

  const jobs = await fetchAll(() => sb.from('jobs')
    .select('id,source_id,title,company,location,logo_url,is_active').eq('company', 'KYNDOF').order('source_id'))
  const jobByCode = Object.fromEntries(jobs.map((j) => [j.source_id, j]))

  const url = (userId, campaign, jobIds) => `${SITE}/api/resume/recommend?t=${makeToken(userId, campaign)}&j=${jobIds.join(',')}`
  const unsubFor = (userId, campaign) => `${SITE}/api/coldmail/unsub?t=${makeToken(userId, campaign)}`

  // ── 검수용 테스트: 한국어 공개/비공개 2통(tech1 그룹 예시), 이벤트 기록 없음 ──
  if (testTo) {
    const { data: rows } = await sb.from('user_profiles').select('id,email,full_name').ilike('email', testTo).limit(1)
    const p = rows?.[0]
    if (!p) { console.error(`계정 없음: ${testTo}`); process.exit(1) }
    const g = GROUPS.find((x) => x.key === 'tech1')
    const gJobs = g.codes.map((c) => jobByCode[c]).filter(Boolean)
    for (const frame of ['public', 'private']) {
      const camp = campaignOf(g.key, frame)
      const u = url(p.id, camp, gJobs.map((j) => j.id)), un = unsubFor(p.id, camp)
      const { error } = await resend.emails.send({
        from: RESEND_FROM, to: p.email, subject: COPY.subject[frame].ko(g.label.ko),
        html: emailHtml(p.full_name, u, un, gJobs, frame, 'ko'), text: emailText(p.full_name, u, un, gJobs, frame, 'ko'),
        headers: { 'List-Unsubscribe': `<${un}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      })
      if (error) { console.error(`발송 실패(${frame}):`, error.message || error); process.exit(1) }
      console.log(`✓ 한국어 테스트(${frame}): ${p.email}`)
      await sleep(400)
    }
    console.log('※ 실발송(--send)은 베트남어로 나갑니다. 이 테스트는 events에 기록하지 않습니다.')
    return
  }

  // ── 풀 로드 + 프리필터 재구성(채점 캐시 키와 동일 기준) ──
  const [pool, unsubs, recs, apps, todays] = await Promise.all([
    fetchAll(() => sb.from('user_profiles')
      .select('id,email,full_name,position,headline,skills,desired_roles,yoe_months,experiences,is_resume_public,korean_cert,english_cert')
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
  // 8/20 유저 정정: 규칙은 1일 1통(todays)이지 1인 1통 영구 제외가 아님 — 타 공고 기수신자도 재추천 허용.
  // 같은 공고 재추천은 recUserByJob(공고별 dedup)이 계속 막는다.
  const appliedByJob = {}
  for (const a of apps) (appliedByJob[a.job_id] ||= new Set()).add(a.user_id)

  const seen = new Set()
  const cohort = pool.filter((p) => {
    if (!p.email || /likelion/i.test(p.email)) return false
    if (unsubSet.has(p.id)) return false
    if (ENGLISH && !englishOk(p.english_cert)) return false
    const e = p.email.toLowerCase()
    if (seen.has(e)) return false
    if (todayUsers.has(p.id) || todayEmails.has(e)) return false
    seen.add(e)
    return true
  })

  // 유저별: 그룹 내 임계 통과 공고 목록과 그룹 대표 점수(최고점)
  const scoreOf = (code, p) => cache[`${code}:${p.id}`]?.score ?? 0
  const prefilterHit = (code, p) => {
    const def = POSITIONS.find((x) => x[0] === code)
    if (!def) return false
    const [, minM, canon, re] = def
    if ((p.yoe_months ?? 0) < minM) return false
    const canonHit = [...posOf(p)].some((x) => canon.includes(x))
    return canonHit || re.test(candText(p))
  }
  const assigned = new Map() // userId -> {p, group, jobs:[job], score, frame}
  for (const p of cohort) {
    let best = null
    for (let gi = 0; gi < GROUPS.length; gi++) {
      const g = GROUPS[gi]
      const okJobs = []
      let gScore = 0
      for (const code of g.codes) {
        if (SKIP.has(code)) continue
        const job = jobByCode[code]
        if (!job || !job.is_active) continue
        if ((appliedByJob[job.id] || new Set()).has(p.id)) continue
        if ((recUserByJob[job.id] || new Set()).has(p.id)) continue
        if (!prefilterHit(code, p)) continue
        const s = scoreOf(code, p)
        if (s >= (minOverride ?? g.min)) { okJobs.push(job); gScore = Math.max(gScore, s) }
      }
      if (!okJobs.length) continue
      // 배정: 점수 우선, 동점이면 GROUPS 정의 순(모수 얇은 그룹 먼저)
      if (!best || gScore > best.score) best = { group: g, jobs: okJobs, score: gScore, gi }
    }
    if (best) {
      const frame = p.is_resume_public ? 'public' : 'private'
      assigned.set(p.id, { p, ...best, frame })
    }
  }

  const list = [...assigned.values()].sort((a, b) => a.gi - b.gi || b.score - a.score)
  console.log(`발송 대상(1인 1통 배정 후): ${list.length}명`)
  for (const g of GROUPS) {
    const rows = list.filter((x) => x.group.key === g.key)
    if (!rows.length) continue
    const pub = rows.filter((x) => x.frame === 'public').length
    console.log(`  ${g.key} (${g.label.ko}, ${minOverride ?? g.min}점+): ${rows.length}명 (공개 ${pub} / 비공개 ${rows.length - pub})`)
  }
  if (!doSend) {
    for (const { p, group, jobs: gj, score, frame } of list.slice(0, 25))
      console.log(`  [${score}·${frame}] ${group.key} · ${p.full_name} <${p.email}> · ${Math.round((p.yoe_months || 0) / 12 * 10) / 10}y · ${gj.map((j) => j.source_id).join('+')}`)
    if (list.length > 25) console.log(`  … 외 ${list.length - 25}명`)
    console.log('\n(dry-run — 실발송하려면 --send, 그룹 한정은 --group <key>)')
    return
  }

  let targets = onlyGroup ? list.filter((x) => x.group.key === onlyGroup) : list
  if (maxN) targets = targets.slice(0, maxN)
  let ok = 0, fail = 0
  for (const { p, group, jobs: gJobs, frame } of targets) {
    const camp = campaignOf(group.key, frame)
    const jobIds = gJobs.map((j) => j.id)
    const u = url(p.id, camp, jobIds), un = unsubFor(p.id, camp)
    const { error } = await resend.emails.send({
      from: RESEND_FROM, to: p.email, subject: COPY.subject[frame].vi(group.label.vi),
      html: emailHtml(p.full_name, u, un, gJobs, frame, 'vi'), text: emailText(p.full_name, u, un, gJobs, frame, 'vi'),
      headers: { 'List-Unsubscribe': `<${un}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    })
    if (error) { console.error(`실패 ${p.email}:`, error.message || error); fail++; continue }
    for (const j of gJobs) {
      await sb.from('job_recommendations').upsert([{
        user_id: p.id, to_email: p.email, job_id: j.id,
        job_title: j.title, job_company: j.company, sent_by: 'coldmail', kind: 'recommend', status: 'sent',
      }], { onConflict: 'user_id,job_id', ignoreDuplicates: true })
    }
    await sb.from('events').insert([{
      event: 'recommend_sent', page: '/scripts/kyndof-recommend-coldmail',
      meta: { campaign: camp, job_ids: jobIds, frame, group: group.key }, user_id: p.id,
    }])
    ok++
    if (ok % 25 === 0) console.log(`  …${ok}/${targets.length}`)
    await sleep(400)
  }
  console.log(`\n✅ 발송 완료: ${ok}/${targets.length} (실패 ${fail})`)
}

main().catch((e) => { console.error(e); process.exit(1) })
