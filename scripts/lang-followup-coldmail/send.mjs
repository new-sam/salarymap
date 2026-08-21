#!/usr/bin/env node
/**
 * 어학 수집 콜드메일 3차 — FYI 에서 지원을 한 번도 안 한 층.
 *
 *   node scripts/lang-followup-coldmail/send.mjs --segment resume            # 드라이런
 *   node scripts/lang-followup-coldmail/send.mjs --segment ghost --test a@b  # 테스트 1통
 *   node scripts/lang-followup-coldmail/send.mjs --segment ghost --send      # 실발송
 *   옵션: --max N · --lang ko|vi (기본 vi)
 *
 * 세그먼트
 *   resume         이력서 O · 지원 0 · 어학 빔 — "이력서는 확인했다, 어학만 비었다"
 *   ghost          이력서 X · 지원 0 · 어학 빔 — "이력서 없어도 괜찮다"(문턱 낮추기)
 *   nocert-applied 이력서 O · 지원 O · 어학 빔 · 미수신 — "지원까지 했는데 어학만 비었다"
 *   nocert-fresh   이력서 O · 지원 0 · 어학 빔 · 미수신 — "어학 되면 지원해볼 자리가 있다"
 *   nocert-again   이력서 O · 어학 빔 · 기수신 — "혹시 어학이 없으신가요"(공백 해소)
 *   selfdesc-recheck 어학은 적었지만 점수가 아닌 층 — "그 뒤로 자격증 따셨나요"(값 검증)
 *
 * 4차(nocert-*) 는 지원 조건을 뺀 회차다. 3차까지의 조건으로는 337명이 남는데 어학이 빈
 * 이력서 보유자는 847명이고, 차이인 510명은 앞 회차 기수신자다. 그 층만 again 으로 뺐다.
 *
 * 왜 지원 경험을 조건에서 뺐나
 *   2차까지의 조건(이력서 O + 지원 1+)은 7명 남아 소진됐다. 남은 층은 전부 지원 이력이
 *   없어서, 2차 문구의 첫 문단("얼마 전 {{company}}에 지원해 주셨죠")이 거짓이 된다.
 *   그래서 개인화를 지원 이력이 아니라 '이력서 유무'로 갈랐다.
 *
 * 제목 A/B 를 하지 않는 이유
 *   2차에서 230명/arm 까지 쌓았는데 차이가 0.4~0.9%p, p≈0.9 였다. 제목으로는 그만한
 *   차이가 안 난다는 게 확인됐으므로 단일 버전으로 보낸다.
 *
 * 이벤트는 2차와 같은 이름(coldmail_lang_sent/_click/_fill)을 쓴다 — 전환 정의가
 * '어학 입력'으로 동일하고, 그래야 기존 대시보드가 그대로 집어간다. 구분은 meta.campaign.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { config } from 'dotenv'
import { makeToken as langToken, leadId } from '../../lib/ktcMailToken.js'
import { makeToken as resumeToken } from '../../lib/campaignToken.js'
// 점수/자기서술 판정은 대시보드와 같은 함수를 쓴다 — 규칙을 두 벌 들면 조용히 갈라진다.
import { certOf } from '../../lib/langTier.js'

config({ path: '.env.local', quiet: true })

const argv = process.argv.slice(2)
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d }
const testTo = arg('--test')
const doSend = argv.includes('--send')
const maxN = arg('--max') ? Number(arg('--max')) : null
const lang = (arg('--lang', 'vi') || 'vi').toLowerCase()
const segment = String(arg('--segment', '') || '').toLowerCase()

/* 같은 날 다른 콜드메일을 받은 사람은 기본으로 뺀다. 팀에서 여러 캠페인이 동시에 도는데
   (오늘도 resume-register-* 두 건이 이미 나갔다) 하루에 두 통을 받게 하면 우리가 아니라
   그 사람 입장에서 스팸이다. 볼륨이 급하면 --allow-same-day 로 끌 수 있지만, 끄기 전에
   그날 나간 다른 캠페인이 무엇인지 확인할 것. */
const allowSameDay = argv.includes('--allow-same-day')

// 어제 SITE_URL 이라는 안 쓰는 변수명 + 없는 도메인을 폴백으로 둬서 메일의 모든 링크가
// 죽었다. outreach/*.mjs 와 같은 규칙으로 통일한다.
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com').replace(/\/$/, '')
const RESEND_FROM = process.env.RESEND_FROM || 'FYI <hello@salary-fyi.com>'

const SEGMENTS = {
  resume: {
    campaign: 'coldmail-lang-resume-1',
    tpl: (l) => `scripts/lang-followup-coldmail/email-resume-${l}.html`,
    // 이력서가 있는 사람 — 이력서 등록 버튼은 없다. '둘 다 못함' 이탈구는 그대로 둔다.
    wantsResume: false,
    match: (p, applied) => !!p.resume_url && !applied.has(p.id),
    subject: {
      vi: (n) => `${n} ơi, bạn biết tiếng Anh hoặc tiếng Hàn không?`,
      ko: (n) => `${n}님, 영어 또는 한국어 가능하신가요?`,
    },
  },
  ghost: {
    campaign: 'coldmail-lang-ghost-1',
    tpl: (l) => `scripts/lang-followup-coldmail/email-ghost-${l}.html`,
    // 이력서가 없는 사람 — '둘 다 못함' 을 빼고 그 자리를 이력서 등록으로 바꿨다.
    // 이력서가 없으면 "둘 다 못한다"를 받아도 매칭에 쓸 수 없지만, 이력서는 그 자체로
    // 값이 크다. 다만 이 층의 대부분은 4일 전 이력서 요청을 이미 거절했으므로 보조에 둔다.
    wantsResume: true,
    match: (p, applied) => !p.resume_url && !applied.has(p.id),
    subject: {
      vi: (n) => `${n} ơi, chưa có CV cũng không sao`,
      ko: (n) => `${n}님, 이력서 없어도 괜찮습니다`,
    },
  },

  /* 4차 — 지원 조건을 아예 뺐다. 3차까지의 조건(지원 0)으로는 337명이 남는데, 어학이 빈
     이력서 보유자는 847명이다. 나머지 510명은 앞 회차에서 이미 한 번 받은 사람들이라
     'again' 으로 따로 뺐다 — 같은 문구를 두 번 보내면 그건 재발송이 아니라 스팸이다.
     셋 다 제목 A/B 는 없다. 2차에서 제목으로는 차이가 안 난다고 판정됐다(p≈0.9). */
  'nocert-applied': {
    campaign: 'coldmail-lang-nocert-applied-1',
    tpl: (l) => `scripts/lang-followup-coldmail/email-nocert-applied-${l}.html`,
    wantsResume: false,
    // 메일이 "얼마 전 {회사}의 {직무}에 지원하셨죠"로 시작한다 — 그래서 '지원 경험'이
    // 아니라 '최근 지원'이 조건이다. 3개월 전 지원자에게 '얼마 전'이라고 쓰면 거짓이고,
    // 이 캠페인은 못 지킬 문장을 한 줄이라도 쓰지 않는 걸 규칙으로 삼았다.
    // 오래된 지원자는 버리지 않고 nocert-fresh 로 넘어간다(그 문구는 지원 이력을
    // 언급하지 않아 누구에게나 참이다).
    match: (p, applied) => !!p.resume_url && applied.has(p.id),
    subject: {
      vi: (n) => `${n} ơi, bạn đã ứng tuyển rồi mà ngoại ngữ còn trống`,
      ko: (n) => `${n}님, 지원은 하셨는데 어학이 비어 있어요`,
    },
  },
  'nocert-fresh': {
    campaign: 'coldmail-lang-nocert-fresh-1',
    tpl: (l) => `scripts/lang-followup-coldmail/email-nocert-fresh-${l}.html`,
    wantsResume: false,
    // 지원이 아예 없는 사람 + 지원이 오래돼 nocert-applied 의 '얼마 전'이 거짓이 되는 사람.
    match: (p, applied) => !!p.resume_url && !applied.has(p.id),
    subject: {
      vi: (n) => `${n} ơi, biết ngoại ngữ thì có chỗ đáng để thử`,
      ko: (n) => `${n}님, 어학 되시면 지원해볼 자리가 있어요`,
    },
  },
  'nocert-again': {
    campaign: 'coldmail-lang-nocert-again-1',
    tpl: (l) => `scripts/lang-followup-coldmail/email-nocert-again-${l}.html`,
    wantsResume: false,
    // 유일하게 기수신자를 대상으로 한다 — 아래 langSent 제외를 이 플래그로 뒤집는다.
    resend: true,
    match: (p) => !!p.resume_url,
    subject: {
      vi: (n) => `${n} ơi, hay là bạn không biết ngoại ngữ?`,
      ko: (n) => `${n}님, 혹시 어학은 없으신가요?`,
    },
  },

  /* 5차 — 어학을 적긴 했는데 자격증·점수가 아닌 사람(Intermediate·Fluent·B1…) 791명.
     앞선 회차와 목적이 다르다: 빈칸을 채우는 게 아니라 이미 받은 답이 아직 유효한지
     확인한다. 그래서 조건이 '어학 빔'이 아니라 '어학 있음 + 점수 아님'이고,
     noLanguage 필터를 건너뛰어야 한다(아래 targets 의 needBlank 참고).
     'None'(못한다고 명시)은 뺀다 — 그건 이미 우리가 원한 확답이라 다시 물을 이유가 없다. */
  'selfdesc-recheck': {
    campaign: 'coldmail-lang-recheck-1',
    tpl: (l) => `scripts/lang-followup-coldmail/email-recheck-${l}.html`,
    wantsResume: false,
    needBlank: false,   // 어학이 채워진 사람이 대상이다
    resend: null,       // 기수신·미수신 둘 다 — 이 층 대부분이 앞 회차 응답자다
    match: (p) => !!p.resume_url
      && (hasText(p.english_cert) || hasText(p.korean_cert))
      && !certOf(p.english_cert) && !certOf(p.korean_cert)
      && ![p.english_cert, p.korean_cert].some((v) => String(v || '').trim().toLowerCase() === 'none'),
    /* 제목을 알림 형식으로 쓴다 — 이미지 등록 캠페인에서 "…선정되지 않았습니다
       (사유: 프로필 사진 없음)"이 반응이 좋았다. 이름을 안 붙이는 것도 그 형식의
       일부다: 개인 인사가 붙는 순간 마케팅 메일로 읽히고 알림처럼 안 읽힌다.
       다만 없는 심사 결과를 지어내지는 않는다 — 우리가 실제로 한 일까지만 쓴다
       ('떨어졌다'가 아니라 '추천해 드리지 못했다'). */
    subject: {
      vi: () => '✉️ Chưa thể giới thiệu bạn cho vị trí yêu cầu ngoại ngữ (lý do: chưa có điểm chính thức)',
      ko: () => '✉️ 어학 요건 공고에 추천해 드리지 못했습니다 (사유: 공인 점수 미확인)',
    },
  },
}

const hasText = (v) => !!String(v || '').trim()

const S = SEGMENTS[segment]
if (!S) { console.error(`--segment 는 ${Object.keys(SEGMENTS).join(' | ')} (받은 값: '${segment}')`); process.exit(1) }
if (!S.subject[lang]) { console.error(`--lang 은 vi 또는 ko (받은 값: '${lang}')`); process.exit(1) }

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* 정렬 없이 range() 로 페이지를 넘기면 안 된다 — Postgres 는 ORDER BY 가 없는
   LIMIT/OFFSET 의 행 순서를 보장하지 않아서, 페이지마다 같은 행이 두 번 오거나 아예
   빠진다. events 의 coldmail 행이 17,621개(18페이지)라 이게 실제로 터졌다:
   같은 명령을 세 번 돌렸더니 기수신자가 1072 / 1452 / 670 명으로 매번 달라졌고,
   그만큼 "이미 받은 사람"이 대상에 다시 섞였다. id 로 고정한다. */
async function all(table, cols, tweak) {
  let out = [], from = 0
  for (;;) {
    let q = sb.from(table).select(cols).order('id', { ascending: true }).range(from, from + 999)
    if (tweak) q = tweak(q)
    const { data, error } = await q
    if (error) throw error
    if (!data?.length) break
    out = out.concat(data)
    if (data.length < 1000) break
    from += 1000
  }
  return out
}

// 어학 3칸이 모두 비었는지 — build-audience.mjs 와 같은 정의여야 한다. 다르면 대상 수가
// 어긋나고, 이미 어학이 있는 사람에게 "어학이 비었다"고 보내게 된다.
const blank = (v) => !String(v || '').trim()
const noLanguage = (p) =>
  blank(p.english_cert) && blank(p.korean_cert)
  && !(Array.isArray(p.languages) && p.languages.some((l) => String(l?.name || '').trim()))

// 어학 버튼 넷은 같은 랜딩으로 간다. cta 는 어느 버튼이 눌렸는지만 남기고 값은 랜딩에서 받는다.
const ctaUrl = (email, kind) =>
  `${SITE}/lang?t=${encodeURIComponent(langToken(email, S.campaign))}&cta=${kind}&lang=${lang}`

const fill = (row) => ({
  name: row.name || (lang === 'vi' ? 'bạn' : '회원'),
  company: row.company || '',
  jobTitle: row.jobTitle || '',
  current: row.current || '',
  ctaScore: ctaUrl(row.email, 'score'),
  ctaDaily: ctaUrl(row.email, 'daily'),
  ctaBasic: ctaUrl(row.email, 'basic'),
  ctaNone: ctaUrl(row.email, 'none'),
  // 5차 전용 — '그대로입니다'. 랜딩이 지금 값을 보여주고 확인만 받는다.
  ctaSame: ctaUrl(row.email, 'same'),
  // 이력서 랜딩만 토큰 체계가 다르다(campaignToken 은 user_id 를 서명한다).
  ctaResume: `${SITE}/api/resume/upload?t=${encodeURIComponent(resumeToken(row.user_id, S.campaign))}`,
  unsub: `${SITE}/api/ktc/unsub?t=${encodeURIComponent(langToken(row.email, S.campaign))}`,
  pixel: `${SITE}/api/o?t=${encodeURIComponent(langToken(row.email, S.campaign))}`,
})

const render = (tpl, p) => tpl
  .replace(/\{\{name\}\}/g, p.name)
  .replace(/\{\{company\}\}/g, p.company)
  .replace(/\{\{jobTitle\}\}/g, p.jobTitle)
  .replace(/\{\{current\}\}/g, p.current)
  .replace(/\{\{ctaScore\}\}/g, p.ctaScore)
  .replace(/\{\{ctaDaily\}\}/g, p.ctaDaily)
  .replace(/\{\{ctaBasic\}\}/g, p.ctaBasic)
  .replace(/\{\{ctaNone\}\}/g, p.ctaNone)
  .replace(/\{\{ctaSame\}\}/g, p.ctaSame)
  .replace(/\{\{ctaResume\}\}/g, p.ctaResume)
  .replace(/\{\{unsubscribeUrl\}\}/g, p.unsub)
  .replace(/\{\{pixelUrl\}\}/g, p.pixel)

;(async () => {
  const tpl = readFileSync(S.tpl(lang), 'utf8')
  const resend = new (await import('resend')).Resend(process.env.RESEND_API_KEY)

  // ── 테스트 발송 ── events 에 아무것도 남기지 않는다.
  if (testTo) {
    for (const to of testTo.split(',').map((s) => s.trim()).filter(Boolean)) {
      const row = {
        email: to, name: lang === 'vi' ? 'Tây' : '유진',
        user_id: '00000000-0000-0000-0000-000000000000',
        company: 'Man Man Market', jobTitle: 'SNS Marketer Intern', current: 'Intermediate',
      }
      const p = fill(row)
      const subject = S.subject[lang](row.name)
      const r = await resend.emails.send({
        from: RESEND_FROM, to, subject: `[TEST/${segment}/${lang}] ` + subject, html: render(tpl, p),
      })
      if (r.error) throw new Error(`${to}: ${r.error.message || 'resend_error'}`)
      console.log(`✅ 테스트 발송 → ${to}  id=${r.data?.id}`)
      console.log(`   세그먼트 ${segment} (${S.campaign})`)
      console.log(`   제목     ${subject}`)
      console.log(`   ctaScore ${p.ctaScore.slice(0, 96)}…`)
      if (S.wantsResume) console.log('   ※ 이력서 버튼은 가짜 user_id 라 랜딩에서 무효 처리된다(정상).')
      await sleep(600)
    }
    return
  }

  const [profiles, apps, evts] = await Promise.all([
    all('user_profiles', 'id,email,full_name,role,resume_url,english_cert,korean_cert,languages'),
    all('job_applications', 'user_id,job_company,job_title,created_at'),
    all('events', 'user_id,event,meta,created_at', (q) => q.ilike('event', 'coldmail%')),
  ])
  /* 사람별 '가장 최근 지원' 1건. nocert-applied 메일이 그 회사·직무를 그대로 쓴다.
     지원이 오래된 사람은 applied 에서 빼서 nocert-fresh 로 흘려보낸다 — '얼마 전'이
     거짓이 되느니 지원 이력을 언급하지 않는 문구로 보내는 게 맞다. */
  const RECENT_DAYS = 90
  const cutoff = new Date(Date.now() - RECENT_DAYS * 86400e3).toISOString()
  const latestApp = new Map()
  for (const a of apps) {
    if (!a.user_id) continue
    const cur = latestApp.get(a.user_id)
    if (!cur || a.created_at > cur.created_at) latestApp.set(a.user_id, a)
  }
  const applied = new Set([...latestApp].filter(([, a]) => a.created_at >= cutoff).map(([id]) => id))
  const staleApplied = latestApp.size - applied.size
  // 수신거부는 user_id 가 아니라 meta.lead(이메일 해시)로만 남는다.
  const unsubLeads = new Set(evts.filter((e) => e.event === 'coldmail_unsub').map((e) => e.meta?.lead).filter(Boolean))
  // 어학 캠페인을 이미 받은 사람 전원 제외 — 2차 583명 + 이 캠페인 기수신분.
  const langSent = new Set(evts.filter((e) => e.event === 'coldmail_lang_sent' && e.user_id).map((e) => e.user_id))

  // 오늘 이미 다른 콜드메일을 받은 사람. 날짜는 ICT(베트남) 기준으로 자른다 — 수신자가
  // 체감하는 '오늘'이 그쪽이다. UTC 로 자르면 저녁 발송이 다음 날로 넘어가 버린다.
  const ictDay = (iso) => new Date(new Date(iso).getTime() + 7 * 3600e3).toISOString().slice(0, 10)
  const today = ictDay(new Date().toISOString())
  const sentToday = {}
  for (const e of evts) {
    if (!e.event.endsWith('_sent') || !e.user_id || ictDay(e.created_at) !== today) continue
    ;(sentToday[e.user_id] = sentToday[e.user_id] || new Set()).add(e.meta?.campaign || '?')
  }

  /* 기수신 조건 — 보통은 이미 받은 사람을 빼지만, resend 세그먼트는 정확히 그 사람들이
     대상이다. 조건을 뒤집을 뿐 나머지(수신거부·같은 날 중복)는 그대로 건다. */
  // resend 가 null 이면 기수신 여부를 따지지 않는다(5차: 이 층 대부분이 앞 회차 응답자다).
  const sendable = (p) => (S.resend == null ? true : S.resend ? langSent.has(p.id) : !langSent.has(p.id))
  // needBlank 가 false 인 세그먼트는 '어학이 채워진 사람'이 대상이라 이 필터를 건너뛴다.
  const blankOk = (p) => (S.needBlank === false ? true : noLanguage(p))

  /* 기업(hr) 계정 제외 — 구직자용 문구가 채용 담당자에게 가면 그 자체로 사고다.
     실제로 어학 빈 이력서 보유자 848명 중 1명이 내부 hr 계정이었다(대시보드는
     처음부터 role!=='hr' 로 세고 있어 두 숫자가 511 vs 510 으로 어긋났다). */
  let targets = profiles.filter((p) =>
    p.email && p.role !== 'hr' && blankOk(p) && S.match(p, applied)
    && sendable(p) && !unsubLeads.has(leadId(p.email))
    && (allowSameDay || !sentToday[p.id]),
  ).map((p) => ({
    user_id: p.id, email: p.email, name: p.full_name || '',
    company: latestApp.get(p.id)?.job_company || '',
    jobTitle: latestApp.get(p.id)?.job_title || '',
    // 5차가 "‘{{current}}’라고 알려주셨었죠"로 되묻는 값. 둘 다 있으면 둘 다 보여준다.
    current: [p.english_cert, p.korean_cert].map((v) => String(v || '').trim()).filter(Boolean).join(' · '),
  }))

  // 무엇 때문에 몇 명이 빠졌는지 보여준다 — 조용히 줄어들면 대상 수가 왜 다른지 못 짚는다.
  const sameDayHit = profiles.filter((p) =>
    p.email && p.role !== 'hr' && blankOk(p) && S.match(p, applied)
    && sendable(p) && !unsubLeads.has(leadId(p.email)) && sentToday[p.id],
  )
  const sameDayCampaigns = [...new Set(sameDayHit.flatMap((p) => [...sentToday[p.id]]))]

  if (maxN) targets = targets.slice(0, maxN)

  console.log(`세그먼트 ${segment} · 캠페인 ${S.campaign}`)
  console.log(`대상 ${targets.length}명 · 템플릿 ${S.tpl(lang)}`)
  console.log(`제목 ${S.subject[lang]('◯◯')}`)
  console.log(`어학 메일 기수신 ${langSent.size}명 `
    + (S.resend == null ? '(이 세그먼트는 기수신 여부를 안 따진다)' : S.resend ? '→ 이 세그먼트의 대상' : '(자동 제외)')
    + ` · 수신거부 ${unsubLeads.size}명 (자동 제외)`)
  console.log(`오늘 다른 콜드메일 수신 ${sameDayHit.length}명 ${allowSameDay ? '→ --allow-same-day 로 포함' : '(제외)'}`
    + (sameDayCampaigns.length ? ` · ${sameDayCampaigns.join(', ')}` : ''))
  console.log(`이름 없는 대상 ${targets.filter((t) => !t.name).length}명 (호칭 폴백)`)
  console.log(`최근 ${RECENT_DAYS}일 지원자 ${applied.size}명 · 그보다 오래된 지원자 ${staleApplied}명은 nocert-fresh 로`)
  // 회사·직무가 비면 "얼마 전 에 지원하셨죠"가 된다. 한 명이라도 있으면 발송을 막는다.
  if (segment === 'selfdesc-recheck') {
    const holes = targets.filter((t) => !t.current)
    if (holes.length) {
      console.error(`\n! 적어둔 어학 값이 빈 대상 ${holes.length}명 — 메일 문장이 깨진다. 중단.`)
      process.exit(1)
    }
  }
  if (segment === 'nocert-applied') {
    const holes = targets.filter((t) => !t.company || !t.jobTitle)
    if (holes.length) {
      console.error(`\n! 회사·직무가 빈 대상 ${holes.length}명 — 메일 문장이 깨진다. 중단.`)
      for (const h of holes.slice(0, 5)) console.error(`  ${h.email}`)
      process.exit(1)
    }
  }

  if (!doSend) {
    console.log('\n[드라이런] 발송하지 않았습니다. --send 로 실발송 + coldmail_lang_sent 기록.')
    for (const t of targets.slice(0, 3)) console.log(`  ${t.email}  ${t.name || '(이름 없음)'}`)
    return
  }

  let ok = 0, fail = 0
  for (const row of targets) {
    try {
      const p = fill(row)
      const resp = await resend.emails.send({
        from: RESEND_FROM, to: row.email, subject: S.subject[lang](p.name), html: render(tpl, p),
      })
      if (resp.error) throw new Error(resp.error.message || 'resend_error')
      await sb.from('events').insert({
        event: 'coldmail_lang_sent',
        user_id: row.user_id,
        meta: { campaign: S.campaign, segment, lang, lead: leadId(row.email), resend_id: resp.data?.id || null },
      })
      ok++
    } catch (e) {
      fail++
      console.error(`  ! ${row.email}: ${e.message}`)
    }
    await sleep(600)
  }
  console.log(`\n발송 ${ok}건 · 실패 ${fail}건`)
})().catch((e) => { console.error(e); process.exit(1) })
