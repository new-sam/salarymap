// Zest(FULL-STACK DEVELOPER) 단일 공고 추천 콜드메일 — 공개/비공개 풀 모두 발송하되 프레임 분리.
//   공개: "Zest 담당자가 당신 이력서를 보고 이 공고를 보냈다 · 지원하면 우선 검토" (nalda 톤)
//   비공개: "FYI가 전체 이력서를 검토해 추천 후보 명단에 선정 · 이번 주 담당자에게 명단 전달 ·
//           지금 지원하면 FYI 추천과 함께 우선 검토" (선정+기한 훅. ⚠️발송 후 실제로 Zest 담당자에게
//           지원자/추천 명단을 공유해야 카피가 지켜진다)
// 캠페인을 프레임별로 분리(zest-recommend1-public / zest-recommend1-private)해서 목표지표
// 콜드메일 공개 탭 캠페인 표에 두 줄로 자동 집계 — 프레임별 전환율 비교용.
// 비공개는 "선정" 프레임에 맞게 매칭 상위 40명만. 발신: Resend.
//
//   node scripts/outreach/zest-recommend-coldmail.mjs --test wsj@likelion.net  # 테스트 1통(스탬프 안 함)
//   node scripts/outreach/zest-recommend-coldmail.mjs                          # dry-run: 대상 목록
//   node scripts/outreach/zest-recommend-coldmail.mjs --send [--max N]         # 실발송 + 로깅
//   옵션: --site http://localhost:3000
import { Resend } from 'resend'
import { sb, env, fetchAll } from './lib.mjs'
import { makeToken } from '../../lib/campaignToken.js'

const JOB_ID = '0d79d519-3e58-4970-9843-641d2de9119f' // Zest — FULL-STACK DEVELOPER (source_id 없음)
const PRIVATE_MAX = null // 상한 없음(Resend 유료). 매칭된 비공개 전원 발송.

const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d }
const testTo = flag('test', null)
const doSend = args.includes('--send')
const CAMPAIGN = { public: 'zest-recommend1-public', private: 'zest-recommend1-private' }
const SITE = String(flag('site', env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com')).replace(/\/$/, '')
const RESEND_FROM = env.RESEND_FROM || 'FYI <hello@salary-fyi.com>'
const maxN = flag('max', null) ? parseInt(flag('max'), 10) : null
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

const JOB_LOCATION_DISPLAY = 'Remote · HCM/Đà Nẵng/Hà Nội'

// ── JD 매칭: 웹 풀스택 필수 · 6개월~5년(JD 1–3년, 완충) ──
const hayOf = (p) => [
  ...(Array.isArray(p.skills) ? p.skills : []),
  p.position, p.headline,
  JSON.stringify(p.experiences || []),
  JSON.stringify(p.resume_summary || {}),
].map((s) => String(s || '').toLowerCase()).join(' | ')

// 가점: LLM/AI agent +3 · Three.js/BIM/CAD +3 · websocket/큐 +2 · JD 명시 1–3년 +2 · 오픈소스 +1
function scoreProfile(p) {
  const hay = hayOf(p)
  const has = (...keys) => keys.some((k) => hay.includes(k))
  if (!has('javascript', 'typescript', 'react', 'node', 'next.js', 'nextjs', 'nestjs', 'vue', 'fullstack', 'full-stack', 'full stack')) return null
  const y = p.yoe_months
  if (y != null && (y < 6 || y > 60)) return null
  let score = 0
  if (has('llm', 'openai', 'gpt', 'langchain', 'ai agent', 'chatbot', 'rag')) score += 3
  if (has('three.js', 'threejs', 'webgl', 'bim', 'ifc', 'autocad', ' cad')) score += 3
  if (has('websocket', 'socket.io', 'rabbitmq', 'celery', 'redis queue', 'bullmq', 'kafka')) score += 2
  if (y != null && y >= 12 && y <= 36) score += 2
  if (has('open source', 'open-source', 'github.com')) score += 1
  return score
}

const firstName = (n) => String(n || '').trim().split(/\s+/).slice(-1)[0] || 'bạn'

// 공개/비공개 프레임 분리 — 제목·인트로·본문 혜택 문장이 다르다
const SUBJECT = {
  public: '[FYI] Zest đã xem hồ sơ của bạn và mời bạn ứng tuyển',
  private: '[FYI] Bạn được chọn vào danh sách đề cử cho vị trí Full-stack tại Zest',
}
const INTRO = {
  public: 'Nhà tuyển dụng của <b>Zest</b> — công ty công nghệ Hàn Quốc phát triển nền tảng AI Agent cho quản lý dự án xây dựng — đã xem hồ sơ của bạn trên FYI và <b>gửi cho bạn vị trí này</b> vì kinh nghiệm của bạn phù hợp với yêu cầu (Full-stack · Web · AI Agent).',
  private: '<b>Zest</b> — công ty công nghệ Hàn Quốc phát triển nền tảng AI Agent cho quản lý dự án xây dựng — đang tuyển Full-stack Developer qua FYI. Đội ngũ FYI đã xem xét toàn bộ hồ sơ đã đăng ký và <b>chọn bạn vào danh sách đề cử</b> gửi cho nhà tuyển dụng.',
}
const INTRO_TEXT = {
  public: 'Nhà tuyển dụng của Zest — công ty công nghệ Hàn Quốc phát triển nền tảng AI Agent cho quản lý dự án xây dựng — đã xem hồ sơ của bạn trên FYI và gửi cho bạn vị trí này vì kinh nghiệm của bạn phù hợp với yêu cầu (Full-stack · Web · AI Agent).',
  private: 'Zest — công ty công nghệ Hàn Quốc phát triển nền tảng AI Agent cho quản lý dự án xây dựng — đang tuyển Full-stack Developer qua FYI. Đội ngũ FYI đã xem xét toàn bộ hồ sơ đã đăng ký và chọn bạn vào danh sách đề cử gửi cho nhà tuyển dụng.',
}
const POSITION_LINE = 'Phát triển Agent Runtime mã nguồn mở, ứng dụng web quản lý dự án và tích hợp trình xem 3D/BIM (Three.js) — làm việc <b>remote</b>.'
const POSITION_LINE_TEXT = 'Phát triển Agent Runtime mã nguồn mở, ứng dụng web quản lý dự án và tích hợp trình xem 3D/BIM (Three.js) — làm việc remote.'
const BENEFIT = {
  public: ' Vì đây là lời mời trực tiếp từ nhà tuyển dụng, hồ sơ của bạn sẽ được <b>ưu tiên xem xét</b> khi ứng tuyển.',
  private: ' <b>Trong tuần này</b>, FYI sẽ gửi danh sách đề cử trực tiếp cho nhà tuyển dụng của Zest. Nếu bạn ứng tuyển ngay, CV của bạn sẽ được gửi kèm lời giới thiệu từ FYI và được <b>ưu tiên xem xét</b> so với ứng viên thông thường.',
}
const BENEFIT_TEXT = {
  public: ' Vì đây là lời mời trực tiếp từ nhà tuyển dụng, hồ sơ của bạn sẽ được ưu tiên xem xét khi ứng tuyển.',
  private: ' Trong tuần này, FYI sẽ gửi danh sách đề cử trực tiếp cho nhà tuyển dụng của Zest. Nếu bạn ứng tuyển ngay, CV của bạn sẽ được gửi kèm lời giới thiệu từ FYI và được ưu tiên xem xét so với ứng viên thông thường.',
}

function emailHtml(name, url, job, frame) {
  const logo = job.logo_url
    ? `<img src="${esc(job.logo_url)}" width="44" height="44" alt="" style="width:44px;height:44px;border-radius:10px;object-fit:cover;background:#f0ebe3;display:block">`
    : `<div style="width:44px;height:44px;border-radius:10px;background:#fff0e6;color:#ff6000;font-weight:800;font-size:16px;text-align:center;line-height:44px">Z</div>`
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1612">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7"><tr><td align="center" style="padding:28px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
  <tr><td style="font-size:20px;font-weight:800;color:#ff6000;padding-bottom:18px">FYI</td></tr>
  <tr><td style="font-size:15px;line-height:1.6;color:#1a1612;padding-bottom:6px">Chào ${esc(firstName(name))},</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:18px">${INTRO[frame]}</td></tr>
  <tr><td style="padding-bottom:14px">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #eee5da;border-radius:14px"><tr>
      <td width="44" style="padding:14px 0 14px 14px;vertical-align:middle">${logo}</td>
      <td style="padding:14px 14px 14px 12px;vertical-align:middle">
        <div style="font-size:12px;color:#8a8073;margin-bottom:3px">${esc(job.company)}</div>
        <div style="font-size:14.5px;font-weight:700;color:#1a1612;line-height:1.35">${esc(job.title)}</div>
        <div style="font-size:12px;color:#b0691a;margin-top:3px">${esc(JOB_LOCATION_DISPLAY)}</div>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:6px">
    ${POSITION_LINE}${BENEFIT[frame]} Chỉ cần <b>1 chạm</b> — CV đã đăng ký của bạn sẽ được gửi tự động.
  </td></tr>
  <tr><td align="center" style="padding:16px 0 6px">
    <a href="${url}" style="display:inline-block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 30px;border-radius:12px">Ứng tuyển 1 chạm →</a>
  </td></tr>
  <tr><td style="font-size:11.5px;color:#a89f92;text-align:center;line-height:1.5;padding-top:20px">
    Bạn nhận được email này vì đã đăng ký hồ sơ trên FYI.<br>— Đội ngũ FYI · <a href="https://salary-fyi.com/jobs" style="color:#a89f92">salary-fyi.com/jobs</a>
  </td></tr>
</table></td></tr></table></body></html>`
}

function emailText(name, url, job, frame) {
  return `Chào ${firstName(name)},

${INTRO_TEXT[frame]}

${job.title} — ${job.company} (${JOB_LOCATION_DISPLAY})

${POSITION_LINE_TEXT}${BENEFIT_TEXT[frame]} Ứng tuyển chỉ với 1 chạm — CV của bạn được gửi tự động:

${url}

— Đội ngũ FYI · salary-fyi.com/jobs`
}

async function main() {
  const { data: jobRows } = await sb.from('jobs')
    .select('id,title,company,role,location,logo_url,is_active')
    .eq('id', JOB_ID).limit(1)
  const job = jobRows?.[0]
  if (!job || !job.is_active) { console.error(`공고 없음/비활성: ${JOB_ID}`); process.exit(1) }
  console.log(`공고: ${job.company} — ${job.title} (${job.id})`)

  const resend = new Resend(env.RESEND_API_KEY)
  const url = (userId, frame) => `${SITE}/api/resume/recommend?t=${makeToken(userId, CAMPAIGN[frame])}&j=${job.id}`

  // ── 테스트 모드: 공개/비공개 프레임 각 1통 ──
  if (testTo) {
    const { data: rows } = await sb.from('user_profiles').select('id,email,full_name').ilike('email', testTo).limit(1)
    const p = rows?.[0]
    if (!p) { console.error(`프로필 없음: ${testTo}`); process.exit(1) }
    for (const frame of ['public', 'private']) {
      const u = url(p.id, frame)
      const { data, error } = await resend.emails.send({
        from: RESEND_FROM, to: p.email, subject: SUBJECT[frame],
        text: emailText(p.full_name, u, job, frame), html: emailHtml(p.full_name, u, job, frame),
      })
      if (error) { console.error(`발송 실패(${frame}):`, error); process.exit(1) }
      console.log(`✅ 테스트 발송(${frame}):`, data?.id, '\n   랜딩:', u)
      await sleep(400)
    }
    return
  }

  // ── 제외 셋: 이 공고 기발송(추천/유사 불문)·기지원자 ──
  const [recs, apps] = await Promise.all([
    fetchAll(() => sb.from('job_recommendations').select('user_id,to_email').eq('job_id', job.id)),
    fetchAll(() => sb.from('job_applications').select('user_id').eq('job_id', job.id)),
  ])
  const sentUser = new Set(recs.map((r) => r.user_id).filter(Boolean))
  const sentEmail = new Set(recs.map((r) => (r.to_email || '').toLowerCase()).filter(Boolean))
  const appliedUser = new Set(apps.map((a) => a.user_id).filter(Boolean))

  // ── 이력서 보유 전체에서 매칭(공개=전원 · 비공개=상위 PRIVATE_MAX명) ──
  const pool = await fetchAll(() => sb.from('user_profiles')
    .select('id,email,full_name,position,headline,skills,yoe_months,experiences,resume_summary,resume_url,is_resume_public')
    .not('resume_url', 'is', null))
  const matched = []
  for (const p of pool) {
    if (!p.resume_url || !p.email || /likelion/i.test(p.email)) continue
    if (sentUser.has(p.id) || sentEmail.has(p.email.toLowerCase()) || appliedUser.has(p.id)) continue
    const score = scoreProfile(p)
    if (score == null) continue
    matched.push({ p, score, frame: p.is_resume_public ? 'public' : 'private' })
  }
  matched.sort((a, b) => b.score - a.score)
  const priv = matched.filter((c) => c.frame === 'private')
  const cohort = [
    ...matched.filter((c) => c.frame === 'public'),
    ...(PRIVATE_MAX ? priv.slice(0, PRIVATE_MAX) : priv),
  ]

  const nPub = cohort.filter((c) => c.frame === 'public').length
  console.log(`대상: ${cohort.length}명 (공개 ${nPub} / 비공개 ${cohort.length - nPub}${PRIVATE_MAX ? ` — 비공개는 상위 ${PRIVATE_MAX} 컷` : ''})`)
  for (const { p, score, frame } of cohort) {
    const y = p.yoe_months
    console.log(`  [${score}·${frame === 'public' ? '공개' : '비공개'}] ${p.full_name} <${p.email}> — ${p.position || '?'} · ${y == null ? '경력?' : Math.round(y / 12 * 10) / 10 + 'y'}`)
  }

  if (!doSend) { console.log('\n(dry-run — 실발송하려면 --send)'); return }

  const list = maxN ? cohort.slice(0, maxN) : cohort
  let ok = 0
  for (const { p, frame } of list) {
    const { error } = await resend.emails.send({
      from: RESEND_FROM, to: p.email, subject: SUBJECT[frame],
      text: emailText(p.full_name, url(p.id, frame), job, frame), html: emailHtml(p.full_name, url(p.id, frame), job, frame),
    })
    if (error) { console.error(`실패 ${p.email}:`, error.message || error); continue }
    await sb.from('job_recommendations').upsert([{
      user_id: p.id, to_email: p.email, job_id: job.id,
      job_title: job.title, job_company: job.company, sent_by: 'coldmail', kind: 'recommend', status: 'sent',
    }], { onConflict: 'user_id,job_id', ignoreDuplicates: true })
    await sb.from('events').insert([{
      event: 'recommend_sent', page: '/scripts/zest-recommend-coldmail',
      meta: { campaign: CAMPAIGN[frame], job_ids: [job.id], frame }, user_id: p.id,
    }])
    ok++
    await sleep(400)
  }
  console.log(`✅ 발송 완료: ${ok}/${list.length}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
