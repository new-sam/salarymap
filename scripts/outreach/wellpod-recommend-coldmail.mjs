// Wellpod — TikTok Shop & Shopify Management Executive 추천 콜드메일 (8명, 전원 개인화).
// 프레임: "네 스펙(한국어)이 희소한데 그걸 정확히 찾는 자리가 났다 — FYI가 CV를 직접 전달하겠다,
// 의향 있나" 1:1 스카우트 톤. 명단/선정 언급 없음, CTA는 지원이 아니라 전달 승낙.
// 제목까지 개인화: [FYI] 이력서의 "{스펙}"을 보고 연락드립니다 — (유저 선택안 A)
// 대상 = data/welford-fit.json fit 8명, 개인화 문장 = data/wellpod-personal-lines.json(ko/vi 사전생성).
//
//   node scripts/outreach/wellpod-recommend-coldmail.mjs --test wsj@likelion.net  # 검수용 한국어 2통(최강·최약 스펙 샘플)
//   node scripts/outreach/wellpod-recommend-coldmail.mjs                          # dry-run
//   node scripts/outreach/wellpod-recommend-coldmail.mjs --send
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const firstName = (n) => String(n || '').trim().split(/\s+/).slice(-1)[0] || 'bạn'

const JOB_ID = 'a7ce2e41-147b-4f36-bbef-bb3e7803485f' // Wellpod — TikTok Shop & Shopify Management Executive
const CAMPAIGN = 'wellpod-recommend1'
const FIT_FILE = new URL('../../data/welford-fit.json', import.meta.url)
const LINES_FILE = new URL('../../data/wellpod-personal-lines.json', import.meta.url)

const COPY = {
  subject: {
    vi: (spec) => `[FYI] Chúng tôi thấy "${spec}" trong hồ sơ của bạn — có vị trí đang tìm đúng hồ sơ này`,
    ko: (spec) => `[FYI] 이력서의 "${spec}"를 보고 연락드립니다 — 이 스펙을 찾는 자리가 났습니다`,
  },
  hi: { vi: (n) => `Chào ${n}, đây là đội ngũ FYI.`, ko: (n) => `안녕하세요 ${n}님, FYI 팀입니다.` },
  intro: {
    vi: (line) => `Chúng tôi liên hệ trực tiếp vì thấy điểm nổi bật trong hồ sơ của bạn — <b>${line}</b>. Nhân sự có thể làm việc bằng tiếng Hàn rất hiếm trên thị trường tuyển dụng Việt Nam, và vị trí yêu cầu đúng hồ sơ này còn hiếm hơn. Vị trí đó vừa mở.`,
    ko: (line) => `${'{'}이름${'}'}님의 이력서에서 눈에 띄는 게 있어 직접 연락드립니다 — <b>${line}</b>. 한국어로 업무할 수 있는 인재는 베트남 채용 시장에서 매우 드물고, 이 스펙을 정확히 요구하는 자리는 더 드뭅니다. 마침 그 자리가 열렸습니다.`,
  },
  tail: {
    vi: 'Wellpod — công ty thương mại điện tử Hàn Quốc phân phối K-pop album toàn cầu và phát triển thương mại TikTok Shop — đang tìm người kết nối trụ sở Hàn Quốc và đội ngũ Việt Nam bằng <b>tiếng Hàn hoặc tiếng Trung</b>. Vì yêu cầu này rất hiếm, gần như không có nhiều ứng viên có thể ứng tuyển. Vì vậy FYI muốn gửi CV của bạn <b>trực tiếp cho nhà tuyển dụng Wellpod</b> — <b>khả năng trúng tuyển rất cao</b>.<br><br>Nếu bạn đồng ý, chỉ cần một nút — CV đã đăng ký sẽ được gửi kèm lời giới thiệu từ FYI.',
    ko: 'K-pop 앨범 글로벌 유통과 TikTok Shop 커머스를 하는 한국 이커머스 기업 <b>Wellpod</b>가 <b>한국어 또는 중국어</b>로 한국 본사와 베트남 팀을 잇는 담당자를 찾습니다. 요구 스펙이 희소해서 지원할 수 있는 사람 자체가 거의 없는 자리입니다. 그래서 FYI가 회원님의 CV를 <b>Wellpod 담당자에게 직접 전달</b>하려고 합니다 — <b>합격 가능성이 매우 높습니다</b>.<br><br>의향이 있으시면 버튼 하나면 됩니다. 등록하신 CV가 FYI의 추천과 함께 바로 전달됩니다.',
  },
  meta: { vi: '15–20 triệu · HCM / Đà Nẵng / Hà Nội · Chào đón fresher', ko: '15–20 triệu · 호치민/다낭/하노이 · 신입 가능' },
  cta: { vi: 'Vâng, hãy gửi hồ sơ của tôi →', ko: '네, 전달해 주세요 →' },
  footer: { vi: 'Bạn nhận được email này vì đã đăng ký hồ sơ trên FYI.', ko: 'FYI에 이력서를 등록하셔서 이 메일을 받으셨습니다.' },
  unsub: { vi: 'Hủy nhận email', ko: '수신 거부' },
}

function emailHtml(name, line, url, unsubUrl, job, lang) {
  const L = (o) => o[lang] || o.vi
  const intro = lang === 'ko'
    ? COPY.intro.ko(line).replace('{이름}', esc(firstName(name)))
    : COPY.intro.vi(line)
  const logo = job.logo_url
    ? `<img src="${esc(job.logo_url)}" width="44" height="44" alt="" style="width:44px;height:44px;border-radius:10px;object-fit:cover;background:#f0ebe3;display:block">`
    : `<div style="width:44px;height:44px;border-radius:10px;background:#fff0e6;color:#ff6000;font-weight:800;font-size:16px;text-align:center;line-height:44px">W</div>`
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1612">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7"><tr><td align="center" style="padding:28px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
  <tr><td style="font-size:20px;font-weight:800;color:#ff6000;padding-bottom:18px">FYI</td></tr>
  <tr><td style="font-size:15px;line-height:1.6;color:#1a1612;padding-bottom:6px">${L(COPY.hi)(esc(firstName(name)))}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:18px">${intro}</td></tr>
  <tr><td style="padding-bottom:14px">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #eee5da;border-radius:14px"><tr>
      <td width="44" style="padding:14px 0 14px 14px;vertical-align:middle">${logo}</td>
      <td style="padding:14px 14px 14px 12px;vertical-align:middle">
        <div style="font-size:12px;color:#8a8073;margin-bottom:3px">${esc(job.company)}</div>
        <div style="font-size:14.5px;font-weight:700;color:#1a1612;line-height:1.35">${esc(job.title)}</div>
        <div style="font-size:12px;color:#b0691a;margin-top:3px">${esc(L(COPY.meta))}</div>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:6px">${L(COPY.tail)}</td></tr>
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
function emailText(name, line, url, unsubUrl, job, lang) {
  const L = (o) => o[lang] || o.vi
  const intro = lang === 'ko' ? COPY.intro.ko(line).replace('{이름}', firstName(name)) : COPY.intro.vi(line)
  return `${L(COPY.hi)(firstName(name))}

${strip(intro)}

${job.title} — ${job.company} (${strip(L(COPY.meta))})

${strip(L(COPY.tail)).replace(/<br><br>/g, '\n\n')}

${url}

${strip(L(COPY.footer))}
— Đội ngũ FYI · salary-fyi.com/jobs
${strip(L(COPY.unsub))}: ${unsubUrl}`
}

async function main() {
  const { data: job } = await sb.from('jobs').select('id,title,company,logo_url,is_active').eq('id', JOB_ID).single()
  if (!job || !job.is_active) { console.error('공고 없음/비활성'); process.exit(1) }
  console.log(`공고: ${job.company} — ${job.title}`)

  const resend = new Resend(env.RESEND_API_KEY)
  const url = (userId) => `${SITE}/api/resume/recommend?t=${makeToken(userId, CAMPAIGN)}&j=${JOB_ID}`
  const unsubFor = (userId) => `${SITE}/api/coldmail/unsub?t=${makeToken(userId, CAMPAIGN)}`

  const lines = JSON.parse(readFileSync(LINES_FILE, 'utf8'))

  // ── 검수용 테스트: 최강(TOPIK6·통번역)·최약(TOPIK3·마케팅) 스펙 샘플 2통, 한국어 ──
  if (testTo) {
    const { data: rows } = await sb.from('user_profiles').select('id,email,full_name').ilike('email', testTo).limit(1)
    const p = rows?.[0]
    if (!p) { console.error(`계정 없음: ${testTo}`); process.exit(1) }
    const samples = Object.values(lines).sort((a, b) => a.spec_ko < b.spec_ko ? 1 : -1)
    for (const s of [samples[0], samples[samples.length - 1]]) {
      const u = url(p.id), un = unsubFor(p.id)
      const { error } = await resend.emails.send({
        from: RESEND_FROM, to: p.email, subject: COPY.subject.ko(s.spec_ko),
        html: emailHtml(p.full_name, s.line_ko, u, un, job, 'ko'), text: emailText(p.full_name, s.line_ko, u, un, job, 'ko'),
        headers: { 'List-Unsubscribe': `<${un}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      })
      if (error) { console.error('발송 실패:', error.message || error); process.exit(1) }
      console.log(`✓ 한국어 테스트(스펙: ${s.spec_ko}): ${p.email}`)
      await sleep(400)
    }
    console.log('※ 실발송(--send)은 베트남어. 이 테스트는 events에 기록하지 않습니다.')
    return
  }

  // ── 대상: fit 8명 재검증 ──
  const verdicts = JSON.parse(readFileSync(FIT_FILE, 'utf8'))
  const fitIds = Object.entries(verdicts).filter(([, v]) => v.fit).map(([id]) => id)
  const [recs, apps, unsubs] = await Promise.all([
    fetchAll(() => sb.from('job_recommendations').select('user_id').eq('job_id', JOB_ID).order('id')),
    fetchAll(() => sb.from('job_applications').select('user_id').eq('job_id', JOB_ID).order('id')),
    fetchAll(() => sb.from('events').select('user_id').eq('event', 'coldmail_unsub').not('user_id', 'is', null).order('id')),
  ])
  const excl = new Set([...recs, ...apps, ...unsubs].map((r) => r.user_id).filter(Boolean))
  const { data: profiles, error } = await sb.from('user_profiles')
    .select('id,email,full_name,resume_url').in('id', fitIds)
  if (error) throw error

  const cohort = profiles.filter((p) => p.email && p.resume_url && !excl.has(p.id) && lines[p.id])
  const missing = fitIds.filter((id) => !lines[id])
  if (missing.length) console.warn(`⚠️개인화 문장 없는 대상 ${missing.length}명 — 제외됨`)
  console.log(`\n대상 ${cohort.length}명:`)
  for (const p of cohort) console.log(`  ${p.full_name} <${p.email}> · 제목스펙: ${lines[p.id].spec_vi}`)

  if (!doSend) { console.log('\n(dry-run — 실발송하려면 --send)'); return }

  let ok = 0, fail = 0
  for (const p of cohort) {
    const l = lines[p.id]
    const u = url(p.id), un = unsubFor(p.id)
    const { error: e } = await resend.emails.send({
      from: RESEND_FROM, to: p.email, subject: COPY.subject.vi(l.spec_vi),
      html: emailHtml(p.full_name, l.line_vi, u, un, job, 'vi'), text: emailText(p.full_name, l.line_vi, u, un, job, 'vi'),
      headers: { 'List-Unsubscribe': `<${un}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    })
    if (e) { fail++; console.error(`  ✗ ${p.email}: ${e.message || e}`); continue }
    await sb.from('job_recommendations').upsert([{
      user_id: p.id, to_email: p.email, job_id: JOB_ID,
      job_title: job.title, job_company: job.company, sent_by: 'coldmail', kind: 'recommend', status: 'sent',
    }], { onConflict: 'user_id,job_id', ignoreDuplicates: true })
    await sb.from('events').insert([{
      event: 'recommend_sent', page: '/scripts/wellpod-recommend-coldmail',
      meta: { campaign: CAMPAIGN, job_id: JOB_ID }, user_id: p.id,
    }])
    ok++
    await sleep(150)
  }
  console.log(`\n✅ 완료: 발송 ${ok} / 실패 ${fail}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
