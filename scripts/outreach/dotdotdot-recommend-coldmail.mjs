// Dotdotdot(큐피스트) Content Marketer 추천 콜드메일 — aw-nx(8/18) 패턴 클론, 단일 공고.
// 대상 = data/dotdotdot-cv-scores.json (원본 CV gpt-4o-mini 채점, 키 "DDD:userId") 3점+.
//   채점은 scripts/outreach/dotdotdot-cv-score.mjs 가 생성 — 이 스크립트는 캐시만 읽는다.
// 프레임: 공개="담당자가 봤다·우선검토" / 비공개="FYI 추천 명단 선정·이번 주 전달·우선검토".
// 카피 수치(7 tỷ KRW·140국·38–40 triệu)는 전부 JD/DB 공고 원문에서만 가져옴.
// ⚠️비공개 카피가 "이번 주 명단 전달"을 약속 — 발송 후 큐피스트 측에 추천 명단 실제 공유할 것.
// ⚠️과제 전형 필수는 메일에 미언급(공고 상세·지원 후 플로우에서 안내) — 유저 확정 8/19.
//
//   node scripts/outreach/dotdotdot-recommend-coldmail.mjs --test wsj@likelion.net  # 검수용 한국어 2통(프레임×2), 이벤트 기록 없음
//   node scripts/outreach/dotdotdot-recommend-coldmail.mjs                          # dry-run: 배정 결과
//   node scripts/outreach/dotdotdot-recommend-coldmail.mjs --send [--max N] [--min 4]
import { readFileSync, existsSync } from 'node:fs'
import { Resend } from 'resend'
import { sb, env, fetchAll } from './lib.mjs'
import { makeToken } from '../../lib/campaignToken.js'

const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d }
const testTo = flag('test', null)
const doSend = args.includes('--send')
const maxN = flag('max', null) ? parseInt(flag('max'), 10) : null
const MIN = flag('min', null) ? parseInt(flag('min'), 10) : 3
const SITE = String(flag('site', env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com')).replace(/\/$/, '')
const RESEND_FROM = env.RESEND_FROM || 'FYI <hello@salary-fyi.com>'
const CACHE_FILE = new URL('../../data/dotdotdot-cv-scores.json', import.meta.url)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const firstName = (n) => String(n || '').trim().split(/\s+/).slice(-1)[0] || 'bạn'

const JOB_ID = 'e9455954-ab65-4d31-b814-e7abdd6f4a6a' // Dotdotdot — Content Marketer (HCMC, 38–40M)
const COMPANY = 'Dotdotdot'
const META = 'TP.HCM · 38–40 triệu'
const campaignOf = (frame) => `dotdotdot-recommend1-${frame}`

// ── 카피 — vi=실발송, ko=검수(--test). 8/19 유저 승인 초안 그대로 ──
const COPY = {
  subject: {
    public: {
      vi: '[FYI] Dotdotdot đã xem hồ sơ của bạn và mời bạn ứng tuyển',
      ko: '[FYI] Dotdotdot이 회원님의 프로필을 보고 지원을 요청했습니다',
    },
    private: {
      vi: '[FYI] Bạn được chọn vào danh sách đề cử cho vị trí Content Marketer tại Dotdotdot',
      ko: '[FYI] Dotdotdot Content Marketer 추천 명단에 선정되셨습니다',
    },
  },
  hi: { vi: (n) => `Chào ${n},`, ko: (n) => `${n}님, 안녕하세요.` },
  intro: {
    public: {
      vi: 'Nhà tuyển dụng của <b>Dotdotdot</b> — dịch vụ AI Companion đến từ Hàn Quốc, doanh thu lũy kế vượt 7 tỷ KRW tại 140 quốc gia — đã xem hồ sơ của bạn trên FYI và <b>gửi cho bạn vị trí này</b> vì kinh nghiệm marketing của bạn phù hợp với yêu cầu.',
      ko: '한국 AI 컴패니언 서비스 <b>Dotdotdot</b>(140개국 누적 매출 70억 원+)의 채용 담당자가 FYI에서 회원님의 프로필을 확인하고, 마케팅 경력이 요구사항과 맞아 <b>이 포지션을 직접 보냈습니다</b>.',
    },
    private: {
      vi: '<b>Dotdotdot</b> — dịch vụ AI Companion đến từ Hàn Quốc, doanh thu lũy kế vượt 7 tỷ KRW tại 140 quốc gia — đang tuyển <b>Content Marketer</b> tại TP.HCM qua FYI. Đội ngũ FYI đã xem xét toàn bộ hồ sơ đã đăng ký và <b>chọn bạn vào danh sách đề cử</b> gửi cho nhà tuyển dụng.',
      ko: '한국 AI 컴패니언 서비스 <b>Dotdotdot</b>(140개국 누적 매출 70억 원+)이 FYI를 통해 호치민 근무 <b>Content Marketer</b>를 채용 중입니다. FYI 팀이 등록된 이력서 전체를 검토해 회원님을 <b>기업에 전달할 추천 명단에 선정</b>했습니다.',
    },
  },
  line: {
    vi: 'Đây là vị trí mang tính <b>Growth Marketing</b>: bạn phụ trách trọn chu trình từ lên ý tưởng, sản xuất nội dung hình ảnh & video (có sử dụng công cụ AI) đến vận hành quảng cáo và tối ưu hiệu quả. Lương <b>38–40 triệu/tháng</b>, làm việc tại TP.HCM.',
    ko: '<b>Growth Marketing</b> 성격의 포지션으로, 아이디어 기획 → 이미지·영상 콘텐츠 제작(AI 툴 활용) → 광고 운영·성과 최적화까지 풀사이클을 담당합니다. 월 <b>38–40 triệu</b>, 호치민 근무.',
  },
  benefit: {
    public: {
      vi: 'Vì đây là lời mời trực tiếp từ nhà tuyển dụng, hồ sơ của bạn sẽ được <b>ưu tiên xem xét</b> khi ứng tuyển.',
      ko: '채용 담당자의 직접 요청이므로 지원 시 <b>우선 검토</b>됩니다.',
    },
    private: {
      vi: '<b>Trong tuần này</b>, FYI sẽ gửi danh sách đề cử trực tiếp cho nhà tuyển dụng. Nếu bạn ứng tuyển ngay, CV của bạn sẽ được gửi kèm lời giới thiệu từ FYI và được <b>ưu tiên xem xét</b> so với ứng viên thông thường.',
      ko: '<b>이번 주에</b> FYI가 채용 담당자에게 추천 명단을 직접 전달합니다. 지금 지원하시면 CV가 FYI의 추천과 함께 전달되어 <b>우선 검토</b>됩니다.',
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
    : `<div style="width:44px;height:44px;border-radius:10px;background:#fff0e6;color:#ff6000;font-weight:800;font-size:16px;text-align:center;line-height:44px">D</div>`
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #eee5da;border-radius:14px;margin-bottom:8px"><tr>
    <td width="44" style="padding:14px 0 14px 14px;vertical-align:middle">${logo}</td>
    <td style="padding:14px 14px 14px 12px;vertical-align:middle">
      <div style="font-size:12px;color:#8a8073;margin-bottom:3px">${esc(COMPANY)}</div>
      <div style="font-size:14.5px;font-weight:700;color:#1a1612;line-height:1.35">${esc(job.title.trim())}</div>
      <div style="font-size:12px;color:#b0691a;margin-top:3px">${esc(META)}</div>
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
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:14px">${L(COPY.intro[frame])}</td></tr>
  <tr><td style="padding-bottom:10px">${jobCard(job)}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:6px">${L(COPY.line)}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-top:4px">${L(COPY.benefit[frame])} ${L(COPY.onetap)}</td></tr>
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

${strip(L(COPY.intro[frame]))}

- ${job.title.trim()} (${COMPANY} · ${META}) — ${SITE}/ktc/jobs/${job.id}

${strip(L(COPY.line))}

${strip(L(COPY.benefit[frame]))} ${strip(L(COPY.onetap))}

${url}

${strip(L(COPY.footer))}
— Đội ngũ FYI · salary-fyi.com/jobs
${strip(L(COPY.unsub))}: ${unsubUrl}`
}

async function main() {
  const resend = new Resend(env.RESEND_API_KEY)
  const { data: job, error: jerr } = await sb.from('jobs').select('id,title,company,logo_url,is_active').eq('id', JOB_ID).single()
  if (jerr || !job) { console.error('공고 없음:', jerr?.message); process.exit(1) }
  if (!job.is_active) { console.error('⛔ 공고 is_active=false — 랜딩이 작동하지 않음. 활성화 후 재실행.'); process.exit(1) }
  console.log(`공고: ${job.company} — ${job.title}`)

  const url = (userId, campaign) => `${SITE}/api/resume/recommend?t=${makeToken(userId, campaign)}&j=${JOB_ID}`
  const unsubFor = (userId, campaign) => `${SITE}/api/coldmail/unsub?t=${makeToken(userId, campaign)}`

  // ── 검수용 테스트: 한국어 2통(프레임×2), 이벤트 기록 없음 ──
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

  if (!existsSync(CACHE_FILE)) { console.error('채점 캐시 없음 — 먼저 dotdotdot-cv-score.mjs 를 실행할 것'); process.exit(1) }
  const cache = JSON.parse(readFileSync(CACHE_FILE, 'utf8'))

  // ── 풀 로드 + 제외(수신거부·기추천·기지원·likelion·이메일 중복·당일 타 캠페인 수신) ──
  const [pool, unsubs, recs, apps, todays] = await Promise.all([
    fetchAll(() => sb.from('user_profiles')
      .select('id,email,full_name,headline,position,yoe_months,is_resume_public')
      .not('email', 'is', null).not('resume_url', 'is', null)
      .order('created_at', { ascending: false })),
    fetchAll(() => sb.from('events').select('user_id').eq('event', 'coldmail_unsub').not('user_id', 'is', null).order('id')),
    fetchAll(() => sb.from('job_recommendations').select('user_id,to_email').eq('job_id', JOB_ID).order('id')),
    fetchAll(() => sb.from('job_applications').select('user_id').eq('job_id', JOB_ID).order('id')),
    fetchAll(() => sb.from('job_recommendations').select('user_id,to_email')
      .gte('created_at', new Date().toISOString().slice(0, 10)).order('id')),
  ])
  const unsubSet = new Set(unsubs.map((r) => r.user_id))
  const recUsers = new Set(recs.map((r) => r.user_id))
  const recEmails = new Set(recs.map((r) => (r.to_email || '').toLowerCase()).filter(Boolean))
  const appliedUsers = new Set(apps.map((r) => r.user_id))
  const todayUsers = new Set(todays.map((r) => r.user_id))
  const todayEmails = new Set(todays.map((r) => (r.to_email || '').toLowerCase()).filter(Boolean))

  const seen = new Set()
  const list = pool.filter((p) => {
    const s = cache[`DDD:${p.id}`]?.score ?? 0
    if (s < MIN) return false
    if (!p.email || /likelion/i.test(p.email)) return false
    if (unsubSet.has(p.id) || recUsers.has(p.id) || appliedUsers.has(p.id)) return false
    const e = p.email.toLowerCase()
    if (seen.has(e) || recEmails.has(e)) return false
    if (todayUsers.has(p.id) || todayEmails.has(e)) return false
    seen.add(e)
    return true
  }).map((p) => ({ p, score: cache[`DDD:${p.id}`].score, frame: p.is_resume_public ? 'public' : 'private' }))
    .sort((a, b) => b.score - a.score || (b.p.yoe_months || 0) - (a.p.yoe_months || 0))

  const pub = list.filter((x) => x.frame === 'public').length
  console.log(`발송 대상(${MIN}점+): ${list.length}명 (공개 ${pub} / 비공개 ${list.length - pub})`)
  if (!doSend) {
    for (const { p, score, frame } of list)
      console.log(`  [${score}·${frame}] ${p.full_name} <${p.email}> · ${Math.round((p.yoe_months || 0) / 12 * 10) / 10}y · ${(p.headline || p.position || '').slice(0, 50)}`)
    console.log('\n(dry-run — 실발송하려면 --send)')
    return
  }

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
      user_id: p.id, to_email: p.email, job_id: JOB_ID,
      job_title: job.title, job_company: job.company, sent_by: 'coldmail', kind: 'recommend', status: 'sent',
    }], { onConflict: 'user_id,job_id', ignoreDuplicates: true })
    await sb.from('events').insert([{
      event: 'recommend_sent', page: '/scripts/dotdotdot-recommend-coldmail',
      meta: { campaign: camp, job_ids: [JOB_ID], frame }, user_id: p.id,
    }])
    ok++
    if (ok % 25 === 0) console.log(`  …${ok}/${targets.length}`)
    await sleep(400)
  }
  console.log(`\n✅ 발송 완료: ${ok}/${targets.length} (실패 ${fail})`)
}

main().catch((e) => { console.error(e); process.exit(1) })
