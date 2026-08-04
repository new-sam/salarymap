#!/usr/bin/env node
/**
 * 유령 회원 되살리기 콜드메일 — 가입만 하고 이력서도 지원도 없는 회원 대상.
 *
 *   node scripts/ghost-coldmail/send.mjs --test you@x.com     # 테스트 1통(events 안 남김)
 *   node scripts/ghost-coldmail/send.mjs                      # 드라이런(대상 수만)
 *   node scripts/ghost-coldmail/send.mjs --send [--max N]     # 실발송
 *
 * 대상 조건 (전부 AND)
 *   1. 이력서 없음(resume_url 빈칸)  — 있으면 이 메일의 전제가 거짓이 된다
 *   2. 지원 이력 없음                — 있으면 '유령'이 아니다
 *   3. 이메일 있음
 *   4. 수신거부 아님                 — events.coldmail_unsub (meta.lead = 이메일 해시)
 *   5. 이 캠페인 미수신              — 중복 발송 방지
 *   ※ 다른 콜드메일 수신 이력은 조건에 넣지 않는다. 이 중 대부분(775명)이 4일 전
 *     resume-register-all1 을 받았고 3.0% 만 이력서를 올렸다. 그 메일은 "파일을
 *     올려라"였고 이 메일은 "어학만 알려달라"라 요청의 무게가 다르다.
 *
 * 버튼이 두 개고 토큰 체계도 두 개다 — 랜딩이 서로 다른 서명을 쓴다.
 *   어학   /lang                → ktcMailToken(email|campaign)
 *   이력서 /api/resume/upload   → campaignToken(userId.campaign)
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

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com').replace(/\/$/, '')
const RESEND_FROM = process.env.RESEND_FROM || 'FYI <hello@salary-fyi.com>'
const CAMPAIGN = 'coldmail-ghost-1'
const TEMPLATE = 'scripts/ghost-coldmail/email-vi.html'
const SUBJECT = (n) => `${n} ơi, chưa có CV cũng không sao`

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

const fill = (row) => ({
  name: row.name || 'bạn',
  // 어학 랜딩은 vi 로 못 박는다 — 파라미터가 빠지면 기본이 vi 라 안전하지만,
  // 명시해 두면 나중에 한국어본을 만들 때 여기만 바꾸면 된다.
  ctaLang: `${SITE}/lang?t=${encodeURIComponent(langToken(row.email, CAMPAIGN))}&cta=score&lang=vi`,
  ctaResume: `${SITE}/api/resume/upload?t=${encodeURIComponent(resumeToken(row.user_id, CAMPAIGN))}`,
  unsub: `${SITE}/api/ktc/unsub?t=${encodeURIComponent(langToken(row.email, CAMPAIGN))}`,
  pixel: `${SITE}/api/o?t=${encodeURIComponent(langToken(row.email, CAMPAIGN))}`,
})

const render = (tpl, p) => tpl
  .replace(/\{\{name\}\}/g, p.name)
  .replace(/\{\{ctaLang\}\}/g, p.ctaLang)
  .replace(/\{\{ctaResume\}\}/g, p.ctaResume)
  .replace(/\{\{unsubscribeUrl\}\}/g, p.unsub)
  .replace(/\{\{pixelUrl\}\}/g, p.pixel)

;(async () => {
  const tpl = readFileSync(TEMPLATE, 'utf8')
  const resend = new (await import('resend')).Resend(process.env.RESEND_API_KEY)

  if (testTo) {
    for (const to of testTo.split(',').map((s) => s.trim()).filter(Boolean)) {
      const row = { email: to, name: 'Tây', user_id: '00000000-0000-0000-0000-000000000000' }
      const p = fill(row)
      const r = await resend.emails.send({
        from: RESEND_FROM, to, subject: `[TEST] ${SUBJECT(row.name)}`, html: render(tpl, p),
      })
      if (r.error) throw new Error(`${to}: ${r.error.message || 'resend_error'}`)
      console.log(`✅ 테스트 발송 → ${to}  id=${r.data?.id}`)
      console.log(`   제목      ${SUBJECT(row.name)}`)
      console.log(`   ctaLang   ${p.ctaLang.slice(0, 100)}…`)
      console.log(`   ctaResume ${p.ctaResume.slice(0, 100)}…`)
      console.log('   ※ 이력서 버튼은 가짜 user_id 라 랜딩에서 무효 처리된다(정상).')
      await sleep(600)
    }
    return
  }

  const [profiles, apps, evts] = await Promise.all([
    all('user_profiles', 'id,email,full_name,resume_url'),
    all('job_applications', 'user_id'),
    all('events', 'user_id,event,meta', (q) => q.ilike('event', 'coldmail%')),
  ])
  const applied = new Set(apps.map((a) => a.user_id).filter(Boolean))
  const unsubLeads = new Set(evts.filter((e) => e.event === 'coldmail_unsub').map((e) => e.meta?.lead).filter(Boolean))
  const already = new Set(
    evts.filter((e) => e.event === 'coldmail_ghost_sent' && e.meta?.campaign === CAMPAIGN)
      .map((e) => e.user_id).filter(Boolean),
  )

  let targets = profiles.filter((p) =>
    p.email && !p.resume_url && !applied.has(p.id)
    && !unsubLeads.has(leadId(p.email)) && !already.has(p.id),
  ).map((p) => ({ user_id: p.id, email: p.email, name: p.full_name || '' }))

  if (maxN) targets = targets.slice(0, maxN)

  console.log(`대상 ${targets.length}명 · 캠페인 ${CAMPAIGN}`)
  console.log(`템플릿 ${TEMPLATE}`)
  console.log(`제목 ${SUBJECT('◯◯')}`)
  console.log(`수신거부 제외 ${unsubLeads.size}명 · 이 캠페인 기수신 제외 ${already.size}명`)

  if (!doSend) {
    console.log('\n[드라이런] 발송하지 않았습니다. --send 로 실발송 + coldmail_ghost_sent 기록.')
    for (const t of targets.slice(0, 3)) console.log(`  ${t.email}  ${t.name || '(이름 없음)'}`)
    return
  }

  let ok = 0, fail = 0
  for (const row of targets) {
    try {
      const p = fill(row)
      const resp = await resend.emails.send({
        from: RESEND_FROM, to: row.email, subject: SUBJECT(p.name), html: render(tpl, p),
      })
      if (resp.error) throw new Error(resp.error.message || 'resend_error')
      await sb.from('events').insert({
        event: 'coldmail_ghost_sent',
        user_id: row.user_id,
        meta: { campaign: CAMPAIGN, lead: leadId(row.email), resend_id: resp.data?.id || null },
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