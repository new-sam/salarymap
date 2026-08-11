// OpenMinds — FULL STACK DEVELOPER (KTC, 하노이·전국 가능) 단일공고 추천 콜드메일.
// 배경: KTC 측(이정애·Alice) 추가 모집 요청 — 기지원 46명이 언어 요건 미달, 이번엔
// "영어 회화 가능 또는 한국어 가능"이 핵심 필터다. 하노이 온사이트지만 채용은 전국 대상(Alice 확인).
//
// 대상 = 풀스택 키워드 매칭(명시 fullstack 또는 FE+BE) × 언어(영어 중급+ 또는 한국어 가능)
//        × 경력 2~6년(JD 3~4년에 완충) → gpt-4o-mini 1~5 채점 통과분(--filter 로 캐시 생성).
//        이진 keep/reject 는 전원 reject 로 수렴한 전례가 있어 채점제만 쓴다(d3 교훈).
// 프레임은 공개/비공개(공개="담당자가 봤다·우선검토", 비공개="FYI 추천 명단 선정·주내 전달·우선검토"),
// 캠페인명도 프레임별 분리(openminds-recommend1-public/-private).
// ⚠️비공개 카피가 "이번 주 명단 전달"을 약속하므로 발송 후 실제로 KTC(이정애·Alice)에 명단을 공유할 것.
//
//   node scripts/outreach/openminds-recommend-coldmail.mjs --filter                 # LLM 채점 캐시 생성(멱등)
//   node scripts/outreach/openminds-recommend-coldmail.mjs                          # dry-run: 대상 목록
//   node scripts/outreach/openminds-recommend-coldmail.mjs --test wsj@likelion.net  # 검수용 한국어 2통(공개/비공개), 이벤트 기록 없음
//   node scripts/outreach/openminds-recommend-coldmail.mjs --send [--max N]
//   옵션: --min 3(채점 임계) --site http://localhost:3000
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { Resend } from 'resend'
import { sb, env, fetchAll, openai } from './lib.mjs'
import { makeToken } from '../../lib/campaignToken.js'

const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d }
const testTo = flag('test', null)
const doSend = args.includes('--send')
const doFilter = args.includes('--filter')
const SITE = String(flag('site', env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com')).replace(/\/$/, '')
const RESEND_FROM = env.RESEND_FROM || 'FYI <hello@salary-fyi.com>'
const maxN = flag('max', null) ? parseInt(flag('max'), 10) : null
const FIT_MIN = parseInt(flag('min', '3'), 10)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const firstName = (n) => String(n || '').trim().split(/\s+/).slice(-1)[0] || 'bạn'

const JOB_ID = '730e7eb4-37bf-4c22-b353-b68df7da0e0c' // OpenMinds — FULL STACK DEVELOPER (source='ktc')
const CAMPAIGN = { public: 'openminds-recommend1-public', private: 'openminds-recommend1-private' }
const CACHE_FILE = new URL('../../data/openminds-coldmail-filter.json', import.meta.url)
const JD_URL = `${SITE}/ktc/jobs/${JOB_ID}`

// ── 게이트: 풀스택 키워드 × 언어 × 경력 ─────────────────────────────────
const hayOf = (p) => [
  ...(Array.isArray(p.skills) ? p.skills : []),
  p.position, p.headline, p.major, p.university,
  JSON.stringify(p.experiences || []),
  JSON.stringify(p.projects || []),
  JSON.stringify(p.resume_summary || {}),
  Array.isArray(p.desired_roles) ? p.desired_roles.join(' ') : p.desired_roles,
].map((s) => String(s || '').toLowerCase()).join(' | ')
const has = (hay, ...ts) => ts.some((t) => hay.includes(t))

const FE = ['react', 'vue', 'angular', 'next.js', 'nextjs', 'nuxt']
const BE = ['node.js', 'nodejs', 'express', 'nestjs', 'nest.js', 'spring', '.net', 'asp.net', 'django', 'fastapi', 'laravel']

// 언어 티어 — english_cert/korean_cert 자기신고값 기준.
// 요청 원문은 "영어 능통"이지만 자기신고 경계가 흐릿해 중급(B2/IELTS 5.5+/TOEIC 650+)까지 포함(B안).
function engTier(c) {
  const s = String(c || '').trim().toLowerCase()
  if (!s || s === 'none') return 0
  const ielts = s.match(/ielts[^0-9]*([0-9](\.[05])?)/)
  if (ielts) return parseFloat(ielts[1]) >= 6.5 ? 2 : parseFloat(ielts[1]) >= 5.5 ? 1 : 0
  const toeic = s.match(/toeic[^0-9]*([0-9]{3})/)
  if (toeic) return parseInt(toeic[1]) >= 800 ? 2 : parseInt(toeic[1]) >= 650 ? 1 : 0
  if (/fluent|native|c1|c2|professional|proficien|advanced|business/.test(s)) return 2
  if (/b2|intermediate|working|conversational|good|toeic|vstep/.test(s)) return 1
  return 0
}
function korTier(c) {
  const s = String(c || '').trim().toLowerCase()
  if (!s || s === 'none' || /novice|beginner|elementary|sơ cấp|cơ bản/.test(s)) return 0
  const topik = s.match(/topik[^0-9]*([0-9])/)
  if (topik) return parseInt(topik[1]) >= 3 ? 1 : 0
  if (/business|advanced|fluent|중급|intermediate|good/.test(s)) return 1
  return 1 // 값이 있는데 판별 불가 → 가능 후보로 두고 LLM 채점에 맡긴다
}

function gate(p) {
  if (!p.email || /likelion/i.test(p.email) || !p.resume_url) return null
  // 근무지 무관이어도 베트남 급여 기준(18~20 triệu) 자리라 베트남 밖 거주자는 뺀다
  if (/texas|usa|united states|singapore|japan|australia|germany|france|canada|korea/i.test(String(p.location || ''))) return null
  const hay = hayOf(p)
  const fs = has(hay, 'full stack', 'fullstack', 'full-stack') || (has(hay, ...FE) && has(hay, ...BE))
  if (!fs) return null
  const e = engTier(p.english_cert), k = korTier(p.korean_cert)
  if (e === 0 && k === 0) return null
  if (p.yoe_months == null || p.yoe_months < 24 || p.yoe_months > 72) return null
  return { e, k }
}

// ── 카피 — vi=실발송 원문, ko=검수용(--test). 수치·조건은 전부 JD와 Alice 확인사항에서만 ──
const COPY = {
  subject: {
    public: {
      vi: '[FYI] OpenMinds đã xem hồ sơ của bạn và mời bạn ứng tuyển — Full Stack Developer',
      ko: '[FYI] OpenMinds가 회원님의 이력서를 보고 지원을 제안했습니다 — Full Stack Developer',
    },
    private: {
      vi: '[FYI] Bạn được chọn vào danh sách đề cử — Full Stack Developer tại OpenMinds',
      ko: '[FYI] 추천 후보 명단에 선정되셨습니다 — OpenMinds Full Stack Developer',
    },
  },
  intro: {
    public: {
      vi: 'Nhà tuyển dụng của <b>OpenMinds</b> — công ty công nghệ Hàn Quốc (thành lập 2016) chuyên giải pháp chuyển đổi số trong sản xuất, nhân sự và khu vực công — đã xem hồ sơ của bạn trên FYI và <b>gửi cho bạn vị trí này</b>.',
      ko: '제조·HR·공공 분야 디지털 전환 솔루션을 만드는 한국 기술기업 <b>OpenMinds</b>(2016년 설립)의 채용 담당자가 FYI에서 회원님의 이력서를 보고 <b>이 포지션을 보냈습니다</b>.',
    },
    private: {
      vi: '<b>OpenMinds</b> — công ty công nghệ Hàn Quốc (thành lập 2016) chuyên giải pháp chuyển đổi số trong sản xuất, nhân sự và khu vực công — đang tuyển Full Stack Developer qua FYI (dự án K-Tech College 2026). Đội ngũ FYI đã xem xét toàn bộ hồ sơ đã đăng ký và <b>chọn bạn vào danh sách đề cử</b> gửi cho nhà tuyển dụng.',
      ko: '제조·HR·공공 분야 디지털 전환 솔루션을 만드는 한국 기술기업 <b>OpenMinds</b>(2016년 설립)가 FYI를 통해 Full Stack Developer를 채용 중입니다(K-Tech College 2026). FYI 팀이 등록된 이력서 전체를 검토해 회원님을 <b>추천 명단에 선정</b>했습니다.',
    },
  },
  // 왜 당신인지 — 이번 추가 모집의 필터가 언어라서, 스택+언어 두 가지를 지목한다
  hook: {
    vi: 'Vị trí này ưu tiên ứng viên Full Stack <b>giao tiếp tốt tiếng Anh hoặc tiếng Hàn</b> — hồ sơ của bạn đáp ứng đúng cả hai tiêu chí đó.',
    ko: '이 포지션은 <b>영어 또는 한국어 회화가 가능한</b> 풀스택 개발자를 우선합니다 — 회원님의 이력서가 두 조건 모두에 해당합니다.',
  },
  line1: {
    vi: 'Phát triển và bảo trì Web/Mobile Application: Front-end (<b>React · Vue · Angular</b>), Back-end (<b>Node.js · Spring Boot · .NET · Django</b>), xây dựng RESTful API và tham gia triển khai, vận hành hệ thống.',
    ko: '웹/모바일 애플리케이션 개발·유지보수: 프론트엔드(<b>React · Vue · Angular</b>), 백엔드(<b>Node.js · Spring Boot · .NET · Django</b>), RESTful API 구축과 배포·운영 참여.',
  },
  line2: {
    vi: 'Yêu cầu <b>3–4 năm kinh nghiệm Full Stack</b> và ít nhất 1 dự án đã triển khai thực tế. <b>Không giới hạn địa điểm làm việc</b>. Lương 18–20 triệu.',
    ko: '요건: <b>풀스택 경력 3–4년</b>, 실서비스 배포 프로젝트 1개 이상. <b>근무지 무관</b>. 급여 18–20백만 동.',
  },
  benefit: {
    public: {
      vi: ' Vì đây là lời mời trực tiếp từ nhà tuyển dụng, hồ sơ của bạn sẽ được <b>ưu tiên xem xét</b> khi ứng tuyển.',
      ko: ' 채용 담당자가 직접 보낸 제안이므로, 지원하시면 이력서가 <b>우선 검토</b>됩니다.',
    },
    private: {
      vi: ' <b>Trong tuần này</b>, FYI sẽ gửi danh sách đề cử trực tiếp cho nhà tuyển dụng của OpenMinds. Nếu bạn ứng tuyển ngay, CV của bạn sẽ được gửi kèm lời giới thiệu từ FYI và được <b>ưu tiên xem xét</b>.',
      ko: ' <b>이번 주에</b> FYI가 OpenMinds 담당자에게 추천 명단을 직접 전달합니다. 지금 지원하시면 FYI의 추천과 함께 CV가 전달되어 <b>우선 검토</b>됩니다.',
    },
  },
  onetap: {
    vi: 'Chỉ cần <b>1 chạm</b> — CV đã đăng ký của bạn sẽ được gửi tự động.',
    ko: '<b>원클릭</b>이면 등록된 CV가 자동으로 전달됩니다.',
  },
  hi: { vi: (n) => `Chào ${n},`, ko: (n) => `${n}님, 안녕하세요.` },
  cta: { vi: 'Ứng tuyển 1 chạm →', ko: '원클릭 지원하기 →' },
  jdLink: { vi: 'Xem mô tả công việc đầy đủ →', ko: '채용공고 전문 보기 →' },
  meta: { vi: 'Không giới hạn địa điểm làm việc', ko: '근무지 무관' },
  footer: { vi: 'Bạn nhận được email này vì đã đăng ký hồ sơ trên FYI.', ko: 'FYI에 이력서를 등록하셔서 이 메일을 받으셨습니다.' },
  unsub: { vi: 'Hủy đăng ký', ko: '수신 거부' },
}

const strip = (s) => String(s).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&')

function emailHtml(name, url, unsubUrl, job, frame, lang) {
  const L = (o) => o[lang] || o.vi
  const logo = job.logo_url
    ? `<img src="${esc(job.logo_url)}" width="44" height="44" alt="" style="width:44px;height:44px;border-radius:10px;object-fit:cover;background:#f0ebe3;display:block">`
    : `<div style="width:44px;height:44px;border-radius:10px;background:#fff0e6;color:#ff6000;font-weight:800;font-size:16px;text-align:center;line-height:44px">O</div>`
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1612">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7"><tr><td align="center" style="padding:28px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
  <tr><td style="font-size:20px;font-weight:800;color:#ff6000;padding-bottom:18px">FYI</td></tr>
  <tr><td style="font-size:15px;line-height:1.6;color:#1a1612;padding-bottom:6px">${esc(L(COPY.hi)(firstName(name)))}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:14px">${L(COPY.intro[frame])}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:18px">${L(COPY.hook)}</td></tr>
  <tr><td style="padding-bottom:14px">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #eee5da;border-radius:14px"><tr>
      <td width="44" style="padding:14px 0 14px 14px;vertical-align:middle">${logo}</td>
      <td style="padding:14px 14px 14px 12px;vertical-align:middle">
        <div style="font-size:12px;color:#8a8073;margin-bottom:3px">${esc(job.company)}</div>
        <div style="font-size:14.5px;font-weight:700;color:#1a1612;line-height:1.35">Full Stack Developer</div>
        <div style="font-size:12px;color:#b0691a;margin-top:3px">${esc(strip(L(COPY.meta)))}</div>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:8px">${L(COPY.line1)}</td></tr>
  <tr><td style="font-size:13.5px;line-height:1.6;color:#6b6357;padding-bottom:6px">${L(COPY.line2)}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-top:10px">
    ${L(COPY.benefit[frame])} ${L(COPY.onetap)}
  </td></tr>
  <tr><td align="center" style="padding:16px 0 6px">
    <a href="${url}" style="display:inline-block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 30px;border-radius:12px">${esc(L(COPY.cta))}</a>
  </td></tr>
  <tr><td align="center" style="font-size:12.5px;padding-bottom:4px">
    <a href="${JD_URL}" style="color:#8a8073">${esc(L(COPY.jdLink))}</a>
  </td></tr>
  <tr><td style="font-size:11.5px;color:#a89f92;text-align:center;line-height:1.5;padding-top:20px">
    ${esc(L(COPY.footer))}<br>— Đội ngũ FYI · <a href="https://salary-fyi.com/jobs" style="color:#a89f92">salary-fyi.com/jobs</a>
    &nbsp;·&nbsp;<a href="${unsubUrl}" style="color:#a89f92;text-decoration:underline">${esc(L(COPY.unsub))}</a>
  </td></tr>
</table></td></tr></table></body></html>`
}

function emailText(name, url, unsubUrl, job, frame, lang) {
  const L = (o) => o[lang] || o.vi
  return `${L(COPY.hi)(firstName(name))}

${strip(L(COPY.intro[frame]))}

${strip(L(COPY.hook))}

Full Stack Developer — ${job.company} (${strip(L(COPY.meta))})

${strip(L(COPY.line1))}
${strip(L(COPY.line2))}

${strip(L(COPY.benefit[frame]))} ${strip(L(COPY.onetap))}

${url}

${strip(L(COPY.jdLink)).replace(' →', '')}: ${JD_URL}

${strip(L(COPY.footer))}
— Đội ngũ FYI · salary-fyi.com/jobs
${strip(L(COPY.unsub))}: ${unsubUrl}`
}

async function main() {
  const { data: job } = await sb.from('jobs').select('id,title,company,logo_url,is_active').eq('id', JOB_ID).single()
  if (!job || !job.is_active) { console.error('공고 없음/비활성'); process.exit(1) }
  console.log(`공고: ${job.company} — ${job.title.trim()}`)

  const resend = new Resend(env.RESEND_API_KEY)
  const url = (userId, frame) => `${SITE}/api/resume/recommend?t=${makeToken(userId, CAMPAIGN[frame])}&j=${JOB_ID}`
  const unsubFor = (userId, frame) => `${SITE}/api/coldmail/unsub?t=${makeToken(userId, CAMPAIGN[frame])}`

  // ── 검수용 테스트: 한국어 공개/비공개 2통, 이벤트 기록 없음 ──
  if (testTo) {
    const { data: rows } = await sb.from('user_profiles').select('id,email,full_name').ilike('email', testTo).limit(1)
    const p = rows?.[0]
    if (!p) { console.error(`계정 없음: ${testTo}`); process.exit(1) }
    for (const frame of ['public', 'private']) {
      const u = url(p.id, frame), un = unsubFor(p.id, frame)
      const { error } = await resend.emails.send({
        from: RESEND_FROM, to: p.email, subject: COPY.subject[frame].ko,
        html: emailHtml(p.full_name, u, un, job, frame, 'ko'), text: emailText(p.full_name, u, un, job, frame, 'ko'),
        headers: { 'List-Unsubscribe': `<${un}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      })
      if (error) { console.error(`발송 실패(${frame}):`, error.message || error); process.exit(1) }
      console.log(`✓ 한국어 테스트(${frame === 'public' ? '공개' : '비공개'} 프레임): ${p.email}`)
      await sleep(400)
    }
    console.log('※ 실발송(--send)은 베트남어로 나갑니다. 이 테스트는 events에 기록하지 않습니다.')
    return
  }

  // ── 게이트 통과 풀 ──
  const [recs, apps, unsubs, pool] = await Promise.all([
    fetchAll(() => sb.from('job_recommendations').select('user_id,to_email').eq('job_id', JOB_ID).order('id')),
    fetchAll(() => sb.from('job_applications').select('user_id').eq('job_id', JOB_ID).order('id')),
    fetchAll(() => sb.from('events').select('user_id').eq('event', 'coldmail_unsub').not('user_id', 'is', null).order('id')),
    fetchAll(() => sb.from('user_profiles')
      .select('id,email,full_name,position,headline,major,university,skills,yoe_months,experiences,projects,resume_summary,resume_url,is_resume_public,english_cert,korean_cert,location,desired_roles')
      .not('resume_url', 'is', null).order('id')),
  ])
  const excl = new Set([...recs, ...apps, ...unsubs].map((r) => r.user_id).filter(Boolean))
  const exclEmail = new Set(recs.map((r) => (r.to_email || '').toLowerCase()).filter(Boolean))

  const gated = []
  for (const p of pool) {
    if (excl.has(p.id) || (p.email && exclEmail.has(p.email.toLowerCase()))) continue
    const g = gate(p)
    if (g) gated.push({ p, ...g })
  }
  console.log(`게이트 통과(풀스택×언어×경력 2~6y, 기발송·기지원·수신거부 제외): ${gated.length}명`)

  // ── --filter: gpt-4o-mini 1~5 채점 → 캐시(멱등, 있는 id는 건너뜀) ──
  if (doFilter) {
    const cache = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {}
    let n = 0
    for (const { p } of gated) {
      if (cache[p.id]) continue
      const exps = (Array.isArray(p.experiences) ? p.experiences : []).slice(0, 3)
        .map((e) => `${e.title || e.position || ''} @ ${e.company || ''}: ${String(e.description || '').slice(0, 200)}`)
      const prompt = `아래는 채용 후보의 이력서 요약이다. "Full Stack Developer (웹 프론트엔드 React/Vue/Angular 중 1개 + 백엔드 Node/Spring/.NET/Django 중 1개, 실무 3~4년)" 포지션 적합도를 1~5로 채점하라.
5=명백한 풀스택 웹 개발자(FE+BE 실무 경력), 4=FE 또는 BE 중심이지만 반대쪽 실무 흔적 있음, 3=웹 개발자이나 풀스택 증거 약함, 2=개발자지만 웹 풀스택 아님(모바일/게임/임베디드/데이터 등), 1=비개발자.
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
      try { cache[p.id] = JSON.parse(r.choices[0].message.content) } catch { cache[p.id] = { score: 0, why: 'parse_error' } }
      n++
      if (n % 20 === 0) { writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 1)); console.log(`  채점 ${n}...`) }
    }
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 1))
    const dist = {}
    gated.forEach(({ p }) => { const s = cache[p.id]?.score ?? '?'; dist[s] = (dist[s] || 0) + 1 })
    console.log(`✅ 채점 완료(신규 ${n}) → ${CACHE_FILE.pathname}`)
    console.log('점수 분포:', dist)
    return
  }

  if (!existsSync(CACHE_FILE)) { console.error('채점 캐시 없음 — 먼저 --filter 를 실행할 것'); process.exit(1) }
  const cache = JSON.parse(readFileSync(CACHE_FILE, 'utf8'))
  const cohort = gated
    .filter(({ p }) => (cache[p.id]?.score ?? 0) >= FIT_MIN)
    .map(({ p, e, k }) => ({ p, e, k, score: cache[p.id].score, frame: p.is_resume_public ? 'public' : 'private' }))
    .sort((a, b) => b.score - a.score || (b.p.yoe_months || 0) - (a.p.yoe_months || 0))

  const count = (f) => cohort.filter((c) => c.frame === f).length
  console.log(`대상(채점 ${FIT_MIN}점+): ${cohort.length}명 (공개 ${count('public')} / 비공개 ${count('private')})`)
  for (const { p, score, frame, e, k } of cohort)
    console.log(`  [${score}·${frame === 'public' ? '공개' : '비공개'}] ${p.full_name} <${p.email}> · ${Math.round((p.yoe_months || 0) / 12 * 10) / 10}y · ${p.position || '?'} · 영${e ? 'O' : 'X'}/한${k ? 'O' : 'X'} · ${String(p.location || '?').slice(0, 24)}`)

  if (!doSend) { console.log('\n(dry-run — 실발송하려면 --send)'); return }

  const list = maxN ? cohort.slice(0, maxN) : cohort
  let ok = 0, fail = 0
  for (const { p, frame } of list) {
    const u = url(p.id, frame), un = unsubFor(p.id, frame)
    const { error } = await resend.emails.send({
      from: RESEND_FROM, to: p.email, subject: COPY.subject[frame].vi,
      html: emailHtml(p.full_name, u, un, job, frame, 'vi'), text: emailText(p.full_name, u, un, job, frame, 'vi'),
      headers: { 'List-Unsubscribe': `<${un}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    })
    if (error) { console.error(`실패 ${p.email}:`, error.message || error); fail++; continue }
    await sb.from('job_recommendations').upsert([{
      user_id: p.id, to_email: p.email, job_id: JOB_ID,
      job_title: job.title, job_company: job.company, sent_by: 'coldmail', kind: 'recommend', status: 'sent',
    }], { onConflict: 'user_id,job_id', ignoreDuplicates: true })
    await sb.from('events').insert([{
      event: 'recommend_sent', page: '/scripts/openminds-recommend-coldmail',
      meta: { campaign: CAMPAIGN[frame], job_ids: [JOB_ID], frame }, user_id: p.id,
    }])
    ok++
    await sleep(400)
  }
  console.log(`✅ 발송 완료: ${ok}/${list.length} (실패 ${fail})`)
}

main().catch((e) => { console.error(e); process.exit(1) })
