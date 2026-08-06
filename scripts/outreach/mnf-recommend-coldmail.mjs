// MNF Solution — AI Engineer (LLM) 단일공고 추천 콜드메일.
// 대상 = 호치민 개발/AI 풀 218명: 키워드 매칭 후 gpt-4o-mini 오탐 필터 통과분(data/mnf-hcmc-filtered.json).
// 프레임은 공개/비공개로 갈린다(공개="담당자가 봤다·우선검토", 비공개="FYI가 추천 명단에 선정 ·
// 이번 주 담당자 전달 · 우선검토"), 캠페인명도 프레임별 분리(mnf-recommend1-public/-private).
// ⚠️비공개 카피가 "이번 주 명단 전달"을 약속하므로 발송 후 실제로 담당자에게 명단을 공유할 것.
//
//   node scripts/outreach/mnf-recommend-coldmail.mjs --test wsj@likelion.net  # 검수용 한국어 2통(공개/비공개), 이벤트 기록 없음
//   node scripts/outreach/mnf-recommend-coldmail.mjs                          # dry-run: 배정 결과
//   node scripts/outreach/mnf-recommend-coldmail.mjs --send [--max N]
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

const JOB_ID = 'a2056f89-e149-44a7-8ad6-adcefea243b7' // MNF Solution — AI Engineer (LLM)
const CAMPAIGN = { public: 'mnf-recommend1-public', private: 'mnf-recommend1-private' }
const COHORT_FILE = new URL('../../data/mnf-hcmc-filtered.json', import.meta.url)

// 카피 — vi=실발송 원문, ko=검수용(--test). 수치·조건은 전부 JD에서 온 것만 쓴다.
const COPY = {
  subject: {
    public: {
      vi: '[FYI] MNF Solution đã xem hồ sơ của bạn và mời bạn ứng tuyển',
      ko: '[FYI] MNF Solution이 회원님의 프로필을 보고 지원을 요청했습니다',
    },
    private: {
      vi: '[FYI] Bạn được chọn vào danh sách đề cử cho vị trí AI Engineer (LLM) tại MNF Solution',
      ko: '[FYI] MNF Solution AI Engineer (LLM) 추천 명단에 선정되셨습니다',
    },
  },
  intro: {
    public: {
      vi: 'Nhà tuyển dụng của <b>MNF Solution</b> — công ty Hàn Quốc xây dựng hệ sinh thái mobility trên nền tảng số, cung cấp giải pháp quản lý cho các công ty cho thuê xe — đã xem hồ sơ của bạn trên FYI và <b>gửi cho bạn vị trí này</b> vì nền tảng lập trình của bạn phù hợp với yêu cầu.',
      ko: '렌터카 관리 솔루션으로 모빌리티 생태계를 만드는 한국 기업 <b>MNF Solution</b>의 채용 담당자가 FYI에서 회원님의 프로필을 확인하고, 개발 역량이 요구사항과 맞아 <b>이 포지션을 직접 보냈습니다</b>.',
    },
    private: {
      vi: '<b>MNF Solution</b> — công ty Hàn Quốc xây dựng hệ sinh thái mobility trên nền tảng số, cung cấp giải pháp quản lý cho các công ty cho thuê xe — đang tuyển AI Engineer (LLM) qua FYI. Đội ngũ FYI đã xem xét toàn bộ hồ sơ đã đăng ký và <b>chọn bạn vào danh sách đề cử</b> gửi cho nhà tuyển dụng.',
      ko: '렌터카 관리 솔루션으로 모빌리티 생태계를 만드는 한국 기업 <b>MNF Solution</b>이 FYI를 통해 AI Engineer (LLM)를 채용 중입니다. FYI 팀이 등록된 이력서 전체를 검토해 회원님을 <b>기업에 전달할 추천 명단에 선정</b>했습니다.',
    },
  },
  // 하단부는 세 문단으로 끊는다(하는 일 / 요건·근무조건 / 우선검토·원탭) — 한 문단에 다 넣으면 안 읽힘.
  line1: {
    vi: 'Phát triển AI Agent, chatbot tư vấn du lịch, tính năng dịch đa ngôn ngữ và Voice AI với <b>Python · FastAPI · OpenAI API · Claude API · LangChain</b>.',
    ko: 'AI Agent·여행 상담 챗봇·다국어 번역·Voice AI를 <b>Python · FastAPI · OpenAI API · Claude API · LangChain</b>으로 개발합니다.',
  },
  line2: {
    vi: '<b>Không yêu cầu kinh nghiệm</b> — chỉ cần nền tảng Python và tinh thần học hỏi; kinh nghiệm AI/LLM là điểm cộng. Làm việc on-site tại <b>Quận 7, TP.HCM</b>, lương thỏa thuận.',
    ko: '<b>경력 무관</b> — Python 기초와 배우려는 자세면 충분하고, AI/LLM 경험은 우대입니다. <b>호치민 7군(Q7) 온사이트</b>, 급여 협의.',
  },
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
  meta: { vi: 'On-site Quận 7 · TP.HCM · Lương thỏa thuận', ko: '온사이트 Q7 · 호치민 · 급여 협의' },
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

function emailHtml(name, url, unsubUrl, job, frame, lang) {
  const L = (o) => o[lang] || o.vi
  const logo = job.logo_url
    ? `<img src="${esc(job.logo_url)}" width="44" height="44" alt="" style="width:44px;height:44px;border-radius:10px;object-fit:cover;background:#f0ebe3;display:block">`
    : `<div style="width:44px;height:44px;border-radius:10px;background:#fff0e6;color:#ff6000;font-weight:800;font-size:16px;text-align:center;line-height:44px">M</div>`
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1612">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7"><tr><td align="center" style="padding:28px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
  <tr><td style="font-size:20px;font-weight:800;color:#ff6000;padding-bottom:18px">FYI</td></tr>
  <tr><td style="font-size:15px;line-height:1.6;color:#1a1612;padding-bottom:6px">${L(COPY.hi)(esc(firstName(name)))}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:18px">${L(COPY.intro[frame])}</td></tr>
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
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:6px">
    ${L(COPY.line1)}<br><br>${L(COPY.line2)}<br><br>${L(COPY.benefit[frame])} ${L(COPY.onetap)}
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
function emailText(name, url, unsubUrl, job, frame, lang) {
  const L = (o) => o[lang] || o.vi
  return `${L(COPY.hi)(firstName(name))}

${strip(L(COPY.intro[frame]))}

${job.title} — ${job.company} (${strip(L(COPY.meta))})

${strip(L(COPY.line1))}

${strip(L(COPY.line2))}

${strip(L(COPY.benefit[frame]))} ${strip(L(COPY.onetap))}

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

  // ── 대상: LLM 필터 통과분을 발송 시점 기준으로 재검증 ──
  const verdicts = JSON.parse(readFileSync(COHORT_FILE, 'utf8'))
  const fitIds = Object.entries(verdicts).filter(([, v]) => v.fit).map(([id]) => id)

  const [recs, apps, unsubs] = await Promise.all([
    fetchAll(() => sb.from('job_recommendations').select('user_id,to_email').eq('job_id', JOB_ID).order('id')),
    fetchAll(() => sb.from('job_applications').select('user_id').eq('job_id', JOB_ID).order('id')),
    fetchAll(() => sb.from('events').select('user_id').eq('event', 'coldmail_unsub').not('user_id', 'is', null).order('id')),
  ])
  const excl = new Set([...recs, ...apps, ...unsubs].map((r) => r.user_id).filter(Boolean))
  const exclEmail = new Set(recs.map((r) => (r.to_email || '').toLowerCase()).filter(Boolean))

  const profiles = []
  for (let i = 0; i < fitIds.length; i += 100) {
    const { data, error } = await sb.from('user_profiles')
      .select('id,email,full_name,yoe_months,headline,position,resume_url,is_resume_public')
      .in('id', fitIds.slice(i, i + 100))
    if (error) throw error
    profiles.push(...data)
  }

  const cohort = profiles
    .filter((p) => p.email && !/likelion/i.test(p.email) && p.resume_url)
    .filter((p) => !excl.has(p.id) && !exclEmail.has(p.email.toLowerCase()))
    .map((p) => ({ p, frame: p.is_resume_public ? 'public' : 'private' }))
    .sort((a, b) => (b.p.yoe_months || 0) - (a.p.yoe_months || 0))

  const count = (f) => cohort.filter((c) => c.frame === f).length
  console.log(`\n대상 ${cohort.length}명 (공개 ${count('public')} / 비공개 ${count('private')})`)
  for (const { p, frame } of cohort)
    console.log(`  [${frame === 'public' ? '공개' : '비공개'}] ${p.full_name} <${p.email}> · ${Math.round((p.yoe_months || 0) / 12 * 10) / 10}y · ${String(p.headline || p.position || '').slice(0, 48)}`)

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
    if (error) { fail++; console.error(`  ✗ ${p.email}: ${error.message || error}`); continue }
    await sb.from('job_recommendations').upsert([{
      user_id: p.id, to_email: p.email, job_id: JOB_ID,
      job_title: job.title, job_company: job.company, sent_by: 'coldmail', kind: 'recommend', status: 'sent',
    }], { onConflict: 'user_id,job_id', ignoreDuplicates: true })
    await sb.from('events').insert([{
      event: 'recommend_sent', page: '/scripts/mnf-recommend-coldmail',
      meta: { campaign: CAMPAIGN[frame], job_id: JOB_ID }, user_id: p.id,
    }])
    ok++
    if (ok % 25 === 0) console.log(`  ...${ok}건 발송`)
    await sleep(120)
  }
  console.log(`\n✅ 완료: 발송 ${ok} / 실패 ${fail}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
