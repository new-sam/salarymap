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
 *   resume  이력서 O · 지원 0 · 어학 빔 — "이력서는 확인했다, 어학만 비었다"(소유 프레임)
 *   ghost   이력서 X · 지원 0 · 어학 빔 — "이력서 없어도 괜찮다"(문턱 낮추기)
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
}

const S = SEGMENTS[segment]
if (!S) { console.error(`--segment 는 resume 또는 ghost (받은 값: '${segment}')`); process.exit(1) }
if (!S.subject[lang]) { console.error(`--lang 은 vi 또는 ko (받은 값: '${lang}')`); process.exit(1) }

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function all(table, cols, tweak) {
  let out = [], from = 0
  for (;;) {
    let q = sb.from(table).select(cols).range(from, from + 999)
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
  ctaScore: ctaUrl(row.email, 'score'),
  ctaDaily: ctaUrl(row.email, 'daily'),
  ctaBasic: ctaUrl(row.email, 'basic'),
  ctaNone: ctaUrl(row.email, 'none'),
  // 이력서 랜딩만 토큰 체계가 다르다(campaignToken 은 user_id 를 서명한다).
  ctaResume: `${SITE}/api/resume/upload?t=${encodeURIComponent(resumeToken(row.user_id, S.campaign))}`,
  unsub: `${SITE}/api/ktc/unsub?t=${encodeURIComponent(langToken(row.email, S.campaign))}`,
  pixel: `${SITE}/api/o?t=${encodeURIComponent(langToken(row.email, S.campaign))}`,
})

const render = (tpl, p) => tpl
  .replace(/\{\{name\}\}/g, p.name)
  .replace(/\{\{ctaScore\}\}/g, p.ctaScore)
  .replace(/\{\{ctaDaily\}\}/g, p.ctaDaily)
  .replace(/\{\{ctaBasic\}\}/g, p.ctaBasic)
  .replace(/\{\{ctaNone\}\}/g, p.ctaNone)
  .replace(/\{\{ctaResume\}\}/g, p.ctaResume)
  .replace(/\{\{unsubscribeUrl\}\}/g, p.unsub)
  .replace(/\{\{pixelUrl\}\}/g, p.pixel)

;(async () => {
  const tpl = readFileSync(S.tpl(lang), 'utf8')
  const resend = new (await import('resend')).Resend(process.env.RESEND_API_KEY)

  // ── 테스트 발송 ── events 에 아무것도 남기지 않는다.
  if (testTo) {
    for (const to of testTo.split(',').map((s) => s.trim()).filter(Boolean)) {
      const row = { email: to, name: lang === 'vi' ? 'Tây' : '유진', user_id: '00000000-0000-0000-0000-000000000000' }
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
    all('user_profiles', 'id,email,full_name,resume_url,english_cert,korean_cert,languages'),
    all('job_applications', 'user_id'),
    all('events', 'user_id,event,meta,created_at', (q) => q.ilike('event', 'coldmail%')),
  ])
  const applied = new Set(apps.map((a) => a.user_id).filter(Boolean))
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

  let targets = profiles.filter((p) =>
    p.email && noLanguage(p) && S.match(p, applied)
    && !langSent.has(p.id) && !unsubLeads.has(leadId(p.email))
    && (allowSameDay || !sentToday[p.id]),
  ).map((p) => ({ user_id: p.id, email: p.email, name: p.full_name || '' }))

  // 무엇 때문에 몇 명이 빠졌는지 보여준다 — 조용히 줄어들면 대상 수가 왜 다른지 못 짚는다.
  const sameDayHit = profiles.filter((p) =>
    p.email && noLanguage(p) && S.match(p, applied)
    && !langSent.has(p.id) && !unsubLeads.has(leadId(p.email)) && sentToday[p.id],
  )
  const sameDayCampaigns = [...new Set(sameDayHit.flatMap((p) => [...sentToday[p.id]]))]

  if (maxN) targets = targets.slice(0, maxN)

  console.log(`세그먼트 ${segment} · 캠페인 ${S.campaign}`)
  console.log(`대상 ${targets.length}명 · 템플릿 ${S.tpl(lang)}`)
  console.log(`제목 ${S.subject[lang]('◯◯')}`)
  console.log(`어학 메일 기수신 ${langSent.size}명 · 수신거부 ${unsubLeads.size}명 (자동 제외)`)
  console.log(`오늘 다른 콜드메일 수신 ${sameDayHit.length}명 ${allowSameDay ? '→ --allow-same-day 로 포함' : '(제외)'}`
    + (sameDayCampaigns.length ? ` · ${sameDayCampaigns.join(', ')}` : ''))
  console.log(`이름 없는 대상 ${targets.filter((t) => !t.name).length}명 (호칭 폴백)`)

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
