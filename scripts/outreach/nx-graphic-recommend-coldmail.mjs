// Nexacode Web/Graphic Designer(8/25 JD 그래픽 전환) 추천 콜드메일 — nx-designer 스크립트(8/18) 복제.
// 배경: 넥사코드가 JD를 UI/UX → 그래픽·시각 디자인 중심(광고소재·배너·SNS콘텐츠·랜딩·상세페이지·PPT)으로
//   수정(같은 jobs.id, Mia가 FYI 공고 수정 완료). 수정 JD에 경력 요건 없음 → 연차 게이트 제거.
//   8/18 발송분 27명(UI/UX 루브릭 3점+)은 job_recommendations 로 자동 제외.
//   유저 결정(8/25): 3점+ 전원 발송, 공개/비공개 프레임 분리.
//
// 대상 = 디자인 게이트(직군 enum ∪ designer 키워드, 연차 무관) × gpt-4o-mini 1~5 채점
//   (캐시 data/nx-graphic-scores.json, 키 "NXGD:userId" — 8/25 산정 세션에서 443명 기채점).
// ⚠️ 카피가 "이번 주 담당자에게 명단 전달"을 약속 — 발송 후 Nexacode 측에 추천 명단 실제 공유할 것.
//
//   node scripts/outreach/nx-graphic-recommend-coldmail.mjs --filter                 # LLM 채점 캐시 갱신(멱등)
//   node scripts/outreach/nx-graphic-recommend-coldmail.mjs                          # dry-run: 집계
//   node scripts/outreach/nx-graphic-recommend-coldmail.mjs --test wsj@likelion.net  # 검수용 한국어 2통(프레임별), 이벤트 기록 없음
//   node scripts/outreach/nx-graphic-recommend-coldmail.mjs --send [--max N]
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { Resend } from 'resend'
import { sb, env, fetchAll, openai } from './lib.mjs'
import { makeToken } from '../../lib/campaignToken.js'

const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d }
const testTo = flag('test', null)
const doSend = args.includes('--send')
const doFilter = args.includes('--filter')
const maxN = flag('max', null) ? parseInt(flag('max'), 10) : null
const SITE = String(flag('site', env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com')).replace(/\/$/, '')
const RESEND_FROM = env.RESEND_FROM || 'FYI <hello@salary-fyi.com>'
const CACHE_FILE = new URL('../../data/nx-graphic-scores.json', import.meta.url)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const firstName = (n) => String(n || '').trim().split(/\s+/).slice(-1)[0] || 'bạn'

// ── 후보 텍스트/게이트 — 8/25 산정 세션과 동일해야 캐시 키가 맞음 ──
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
const DESIGN_ROLES = ['Design', 'UI/UX Designer', 'Graphic Designer']
// designer 명시어만(裸 \bui\b 금지 — 프론트엔드/QA 오탐 방지)
const DESIGN_RE = /designer|thiết kế|đồ họa|graphic design|product design|ui\/?ux|ux\/?ui|ui design|web design|figma/

const G = {
  key: 'nxg1', code: 'NXGD', jobId: '71907b33-f58b-4955-9ec4-e4398beb3ffd', min: 3, // 3점+ 전원(유저 결정 8/25)
  label: { vi: 'Web / Graphic Designer', ko: '웹/그래픽 디자이너' },
  company: 'Nexacode',
  locationDisplay: 'Remote',
  gate: (p) => [...posOf(p)].some((x) => DESIGN_ROLES.includes(x)) || DESIGN_RE.test(candText(p)),
  rubric: `"Web / Graphic Designer" 포지션 적합도를 1~5로 채점하라.
공고: SaaS·ERP·DX 소프트웨어 회사 Nexacode의 웹/그래픽 디자이너. 풀리모트. 주업무: 디지털 광고 소재·배너, SNS 콘텐츠·썸네일 등 마케팅 콘텐츠, 랜딩페이지·프로모션 페이지, 상품·서비스 상세페이지, 기업 홈페이지·브랜드 웹페이지, 캠페인 그래픽, PPT·제안서 등 비즈니스 문서 디자인. UI 디자인은 일부(필요시 웹·앱 화면·기존 UI 개선). 필수: Figma 웹페이지·콘텐츠 디자인, 레이아웃·타이포·색상 등 시각디자인 기본기, 다양한 디자인 업무 유연 수행, 포트폴리오, 리모트 자기관리. 우대: 광고 소재·마케팅 콘텐츠 경험, 랜딩·상세페이지 경험, 브랜드·그래픽 경험, Photoshop·Illustrator, 간단한 UI 경험, AI 디자인 도구. 경력 연차 요건 없음.
5=그래픽·비주얼·마케팅 콘텐츠 디자인 실무가 명확(광고소재/배너/SNS콘텐츠/랜딩·상세페이지 중 복수)하고 Figma 또는 Photoshop·Illustrator 활용이 확인되며, 브랜드·웹페이지·UI 병행 등 우대 신호까지 있음
4=그래픽·웹·마케팅 콘텐츠 디자인 실무가 명확(우대 신호는 약함)
3=UI/UX 중심 디자이너지만 배너·SNS·랜딩 등 그래픽·마케팅 소재 병행 증거가 있거나, 그래픽 디자이너인데 실무 증거가 부분적임
2=순수 UI/UX·프로덕트 디자이너로 그래픽·마케팅 소재 증거 없음, 또는 영상·3D·인테리어 등 인접 분야
1=디자이너가 아님`,
}
const campaignOf = (frame) => `nexacode-graphic-recommend1-${frame}`

// ── 카피 — vi=실발송, ko=검수(--test). kyndof 정직 프레임 재사용 ──
const COPY = {
  subject: {
    public: {
      vi: `[FYI] Bạn được chọn vào danh sách đề cử gửi ${G.company} — ${G.label.vi}`,
      ko: `[FYI] ${G.company} 추천 명단에 선정되셨습니다 — ${G.label.ko}`,
    },
    private: {
      vi: `[FYI] Bạn được chọn vào danh sách đề cử — ${G.label.vi} tại ${G.company}`,
      ko: `[FYI] 추천 후보 명단에 선정되셨습니다 — ${G.company} ${G.label.ko}`,
    },
  },
  hi: { vi: (n) => `Chào ${n},`, ko: (n) => `${n}님, 안녕하세요.` },
  intro: {
    vi: '<b>Nexacode</b> — công ty phần mềm xây dựng sản phẩm SaaS, ERP và giải pháp chuyển đổi số — đang tuyển <b>Web / Graphic Designer</b> làm việc <b>hoàn toàn từ xa (remote)</b>. Công việc tập trung vào thiết kế ấn phẩm quảng cáo số·banner, nội dung SNS·thumbnail, landing page·trang khuyến mãi, trang chi tiết sản phẩm·dịch vụ, website doanh nghiệp·brand, cùng tài liệu doanh nghiệp (PPT, proposal); khi cần có thể tham gia thiết kế·cải thiện UI web·mobile. Yêu cầu sử dụng thành thạo <b>Figma</b>, có nền tảng thiết kế thị giác (layout·typography·màu sắc) và portfolio; kinh nghiệm Photoshop·Illustrator là lợi thế.',
    ko: 'SaaS·ERP·DX 소프트웨어 회사 <b>Nexacode</b>가 <b>풀리모트</b> <b>웹/그래픽 디자이너</b>를 채용 중입니다. 디지털 광고 소재·배너, SNS 콘텐츠·썸네일, 랜딩·프로모션·상세페이지, 기업 홈페이지·브랜드 웹페이지, PPT·제안서 등 그래픽·시각 디자인이 중심이고 필요시 웹·앱 UI 디자인·개선도 일부 다룹니다. <b>Figma</b> 활용과 시각 디자인 기본기(레이아웃·타이포·컬러), 포트폴리오가 필요하며 Photoshop·Illustrator 경험은 우대 요소입니다.',
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

function jobCard(job) {
  const logo = job.logo_url
    ? `<img src="${esc(job.logo_url)}" width="44" height="44" alt="" style="width:44px;height:44px;border-radius:10px;object-fit:cover;background:#f0ebe3;display:block">`
    : `<div style="width:44px;height:44px;border-radius:10px;background:#fff0e6;color:#ff6000;font-weight:800;font-size:16px;text-align:center;line-height:44px">${esc(G.company[0])}</div>`
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #eee5da;border-radius:14px;margin-bottom:8px"><tr>
    <td width="44" style="padding:14px 0 14px 14px;vertical-align:middle">${logo}</td>
    <td style="padding:14px 14px 14px 12px;vertical-align:middle">
      <div style="font-size:12px;color:#8a8073;margin-bottom:3px">${esc(G.company)}</div>
      <div style="font-size:14.5px;font-weight:700;color:#1a1612;line-height:1.35">${esc(job.title.trim())}</div>
      <div style="font-size:12px;color:#b0691a;margin-top:3px">${esc(G.locationDisplay)}</div>
    </td>
  </tr></table>`
}

function emailHtml(name, url, unsubUrl, job, frame, lang) {
  const L = (o) => o[lang] || o.vi
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1612">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7"><tr><td align="center" style="padding:28px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
  <tr><td style="padding-bottom:18px"><img src="https://salary-fyi.com/fyi-logo.png" height="24" alt="FYI" style="height:24px;width:auto;display:block"></td></tr>
  <tr><td style="font-size:15px;line-height:1.6;color:#1a1612;padding-bottom:6px">${esc(L(COPY.hi)(firstName(name)))}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:14px">${L(COPY.intro)}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:14px">${L(COPY.hook)}</td></tr>
  <tr><td style="padding-bottom:10px">${jobCard(job)}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-top:4px">${L(COPY.benefit[frame])(G.company)} ${L(COPY.onetap)}</td></tr>
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

function emailText(name, url, unsubUrl, job, frame, lang) {
  const L = (o) => o[lang] || o.vi
  return `${L(COPY.hi)(firstName(name))}

${strip(L(COPY.intro))}

${strip(L(COPY.hook))}

- ${job.title.trim()} (${G.company} · ${G.locationDisplay}) — ${SITE}/ktc/jobs/${job.id}

${strip(L(COPY.benefit[frame])(G.company))} ${strip(L(COPY.onetap))}

${url}

${strip(L(COPY.footer))}
— Đội ngũ FYI · salary-fyi.com/jobs
${strip(L(COPY.unsub))}: ${unsubUrl}`
}

async function main() {
  const resend = new Resend(env.RESEND_API_KEY)
  const { data: job, error: jobErr } = await sb.from('jobs')
    .select('id,source_id,title,company,location,logo_url,is_active').eq('id', G.jobId).single()
  if (jobErr || !job) { console.error(`공고 없음: ${G.code} (${G.jobId})`, jobErr?.message || ''); process.exit(1) }
  if (!job.is_active) console.warn(`⚠️ ${G.code}(${G.company}) is_active=false — 랜딩 비노출 상태. 발송 전 활성화 필요(--send 거부).`)
  if (!/graphic/i.test(job.title)) console.warn(`⚠️ 공고 제목이 그래픽 JD가 아님: "${job.title}" — Mia 수정 반영 확인 필요`)

  const url = (userId, campaign) => `${SITE}/api/resume/recommend?t=${makeToken(userId, campaign)}&j=${G.jobId}`
  const unsubFor = (userId, campaign) => `${SITE}/api/coldmail/unsub?t=${makeToken(userId, campaign)}`

  // ── 검수용 테스트: 프레임별 한국어 2통, 이벤트 기록 없음 ──
  if (testTo) {
    const { data: rows } = await sb.from('user_profiles').select('id,email,full_name').ilike('email', testTo).limit(1)
    const p = rows?.[0]
    if (!p) { console.error(`계정 없음: ${testTo}`); process.exit(1) }
    for (const frame of ['public', 'private']) {
      const camp = campaignOf(frame)
      const u = url(p.id, camp), un = unsubFor(p.id, camp)
      const { error } = await resend.emails.send({
        from: RESEND_FROM, to: p.email, subject: COPY.subject[frame].ko,
        html: emailHtml(p.full_name, u, un, job, frame, 'ko'), text: emailText(p.full_name, u, un, job, frame, 'ko'),
        headers: { 'List-Unsubscribe': `<${un}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      })
      if (error) { console.error(`발송 실패(${frame}):`, error.message || error); process.exit(1) }
      console.log(`✓ 한국어 테스트(${frame}): ${p.email}`)
      await sleep(400)
    }
    console.log('※ 실발송(--send)은 베트남어로 나갑니다. 이 테스트는 events에 기록하지 않습니다.')
    return
  }

  // ── 풀 로드 + 제외(수신거부·기추천(8/18 포함)·기지원·likelion·이메일 중복) ──
  const [pool, unsubs, recs, apps] = await Promise.all([
    fetchAll(() => sb.from('user_profiles')
      .select('id,email,full_name,position,headline,skills,desired_roles,yoe_months,experiences,is_resume_public,resume_summary')
      .not('email', 'is', null).not('resume_url', 'is', null)
      .order('created_at', { ascending: false })),
    fetchAll(() => sb.from('events').select('user_id').eq('event', 'coldmail_unsub').not('user_id', 'is', null).order('id')),
    fetchAll(() => sb.from('job_recommendations').select('user_id,to_email').eq('job_id', G.jobId).order('id')),
    fetchAll(() => sb.from('job_applications').select('user_id').eq('job_id', G.jobId).order('id')),
  ])
  const unsubSet = new Set(unsubs.map((r) => r.user_id))
  const recUsers = new Set(recs.map((r) => r.user_id))
  const recEmails = new Set(recs.map((r) => (r.to_email || '').toLowerCase()).filter(Boolean))
  const appliedUsers = new Set(apps.map((a) => a.user_id))

  const seen = new Set()
  const gated = pool.filter((p) => {
    if (!p.email || /likelion/i.test(p.email)) return false
    if (unsubSet.has(p.id)) return false
    const e = p.email.toLowerCase()
    if (seen.has(e) || recEmails.has(e)) return false
    seen.add(e)
    if (recUsers.has(p.id) || appliedUsers.has(p.id)) return false
    return G.gate(p)
  })
  console.log(`게이트 통과: ${gated.length}명`)

  // ── --filter: gpt-4o-mini 1~5 채점 → 캐시(멱등, 8/25 산정분 재사용) ──
  if (doFilter) {
    const cache = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {}
    let n = 0
    for (const p of gated) {
      const key = `${G.code}:${p.id}`
      if (cache[key]) continue
      const exps = (Array.isArray(p.experiences) ? p.experiences : []).slice(0, 3)
        .map((e) => `${e.title || e.position || ''} @ ${e.company || ''}: ${String(e.description || '').slice(0, 200)}`)
      const prompt = `아래는 채용 후보의 이력서 요약이다. ${G.rubric}
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
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 1))
    const dist = {}
    gated.forEach((p) => { const s = cache[`${G.code}:${p.id}`]?.score ?? '?'; dist[s] = (dist[s] || 0) + 1 })
    console.log(`✅ 점수 분포:`, dist)
    console.log(`채점 완료(신규 ${n}) → data/nx-graphic-scores.json`)
    return
  }

  if (!existsSync(CACHE_FILE)) { console.error('채점 캐시 없음 — 먼저 --filter 를 실행할 것'); process.exit(1) }
  const cache = JSON.parse(readFileSync(CACHE_FILE, 'utf8'))

  const list = gated
    .map((p) => ({ p, score: cache[`${G.code}:${p.id}`]?.score ?? 0, frame: p.is_resume_public ? 'public' : 'private' }))
    .filter((x) => x.score >= G.min)
    .sort((a, b) => b.score - a.score)
  const pub = list.filter((x) => x.frame === 'public').length
  console.log(`발송 대상(${G.min}점+): ${list.length}명 (공개 ${pub} / 비공개 ${list.length - pub})`)
  if (!doSend) {
    for (const { p, score, frame } of list)
      console.log(`  [${score}·${frame}] ${p.full_name} <${p.email}> · ${Math.round((p.yoe_months || 0) / 12 * 10) / 10}y · ${(p.headline || p.position || '').slice(0, 50)}`)
    console.log('\n(dry-run — 실발송하려면 --send)')
    return
  }

  if (!job.is_active) { console.error(`⛔ 발송 중단 — ${G.code} is_active=false (랜딩이 작동하지 않음, 활성화 후 재실행)`); process.exit(1) }
  const targets = maxN ? list.slice(0, maxN) : list
  let ok = 0, fail = 0
  for (const { p, frame } of targets) {
    const camp = campaignOf(frame)
    const u = url(p.id, camp), un = unsubFor(p.id, camp)
    const { error } = await resend.emails.send({
      from: RESEND_FROM, to: p.email, subject: COPY.subject[frame].vi,
      html: emailHtml(p.full_name, u, un, job, frame, 'vi'), text: emailText(p.full_name, u, un, job, frame, 'vi'),
      headers: { 'List-Unsubscribe': `<${un}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    })
    if (error) { console.error(`실패 ${p.email}:`, error.message || error); fail++; continue }
    await sb.from('job_recommendations').upsert([{
      user_id: p.id, to_email: p.email, job_id: G.jobId,
      job_title: job.title, job_company: job.company, sent_by: 'coldmail', kind: 'recommend', status: 'sent',
    }], { onConflict: 'user_id,job_id', ignoreDuplicates: true })
    await sb.from('events').insert([{
      event: 'recommend_sent', page: '/scripts/nx-graphic-recommend-coldmail',
      meta: { campaign: camp, job_ids: [G.jobId], frame, group: G.key }, user_id: p.id,
    }])
    ok++
    if (ok % 25 === 0) console.log(`  …${ok}/${targets.length}`)
    await sleep(400)
  }
  console.log(`\n✅ 발송 완료: ${ok}/${targets.length} (실패 ${fail})`)
}

main().catch((e) => { console.error(e); process.exit(1) })
