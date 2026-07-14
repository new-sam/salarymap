// 비공개 이력서 보유자 → "공개하면 축하금 이벤트 참여 가능" 콜드메일(베트남어).
// 발신: Resend, 우리 도메인 hello@salary-fyi.com (RESEND_FROM). 원클릭 추적링크로 공개 전환.
//
//   node scripts/outreach/resume-public-coldmail.mjs --source cv                 # dry-run: 대상 수/샘플/CSV
//   node scripts/outreach/resume-public-coldmail.mjs --test wsj@likelion.net     # 테스트 1통(스탬프 안 함)
//   node scripts/outreach/resume-public-coldmail.mjs --source cv --send          # 실발송 + coldmail_public_sent 스탬프
//   옵션: --source cv · --platform web|app · --limit N · --max N(한 번에 N명) · --campaign coldmail1
//
// ⚠️ 토큰 시크릿(RESUME_PUBLIC_TOKEN_SECRET, 없으면 GOAL_METRICS_PASSWORD)은
//    .env.local 과 Vercel(prod)에 동일해야 prod 링크가 검증된다. go-public 배포 후에만 버튼이 동작.
import { writeFileSync } from 'node:fs'
import { sb, env } from './lib.mjs' // .env.local → process.env 주입 포함
import { makeToken } from '../../lib/campaignToken.js'

const SITE = (env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com').replace(/\/$/, '')
const RESEND_FROM = env.RESEND_FROM || 'FYI <hello@salary-fyi.com>'
const EXCLUDED = ['likelion.net']
const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d }
const doSend = args.includes('--send')
const testTo = flag('test', null)
const campaign = flag('campaign', 'coldmail1')
const source = flag('source', null)
const platform = flag('platform', null)
const limit = flag('limit', null)
const max = flag('max', null)
const out = flag('out', `./resume-public-${campaign}.csv`)

const link = (userId) => `${SITE}/api/resume/go-public?t=${makeToken(userId, campaign)}`
const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const esc = (s) => String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))

// ── 베트남어 이메일 ──
const SUBJECT = 'CV của bạn đang ẩn — công khai để nhận thưởng 2.000.000₫ 🎁'
function emailText(name, url) {
  return `Chào ${name || 'bạn'},

Cảm ơn bạn đã đăng ký CV trên FYI để tham gia sự kiện thưởng 2.000.000₫! 🎉

Nhưng CV của bạn đang ở chế độ RIÊNG TƯ. Khi còn riêng tư:
• Các công ty không thể xem hồ sơ của bạn
• Bạn CHƯA đủ điều kiện tham gia sự kiện thưởng

Chỉ cần 1 chạm để công khai CV và tham gia ngay:
${url}

Sau khi công khai, các công ty phù hợp sẽ chủ động liên hệ, và bạn đủ điều kiện nhận thưởng 2.000.000₫ khi được tuyển qua FYI.

— Đội ngũ FYI (salary-fyi.com)
Đây là email tự động. Nếu bạn không muốn công khai, chỉ cần bỏ qua email này.`
}
function emailHtml(name, url) {
  return `<!doctype html><html><body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1612">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
  <div style="font-size:20px;font-weight:800;color:#ff6000;margin-bottom:20px">FYI</div>
  <div style="background:#fff;border:1px solid #eee5da;border-radius:18px;padding:30px 26px">
    <p style="font-size:15px;margin:0 0 14px">Chào <b>${esc(name) || 'bạn'}</b>,</p>
    <p style="font-size:14.5px;line-height:1.6;margin:0 0 16px">Cảm ơn bạn đã đăng ký CV trên FYI để tham gia <b>sự kiện thưởng 2.000.000₫</b>! 🎉</p>
    <p style="font-size:14.5px;line-height:1.6;margin:0 0 8px">Nhưng CV của bạn đang ở chế độ <b style="color:#d92d20">RIÊNG TƯ</b>. Khi còn riêng tư:</p>
    <ul style="font-size:14px;line-height:1.7;margin:0 0 18px;padding-left:20px;color:#4a4238">
      <li>Các công ty <b>không thể xem</b> hồ sơ của bạn</li>
      <li>Bạn <b>chưa đủ điều kiện</b> tham gia sự kiện thưởng</li>
    </ul>
    <p style="font-size:14.5px;line-height:1.6;margin:0 0 20px">Chỉ cần 1 chạm để công khai CV và tham gia ngay:</p>
    <div style="text-align:center;margin:0 0 22px">
      <a href="${url}" style="display:inline-block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 28px;border-radius:12px">Công khai CV &amp; tham gia sự kiện →</a>
    </div>
    <p style="font-size:13px;line-height:1.6;color:#8a8073;margin:0">Sau khi công khai, các công ty phù hợp sẽ chủ động liên hệ, và bạn đủ điều kiện nhận thưởng 2.000.000₫ khi được tuyển qua FYI.</p>
  </div>
  <p style="font-size:11.5px;color:#a89f92;text-align:center;margin:18px 0 0;line-height:1.5">— Đội ngũ FYI · salary-fyi.com<br>Đây là email tự động. Nếu bạn không muốn công khai, chỉ cần bỏ qua email này.</p>
</div></body></html>`
}

async function fetchAll(build) {
  const PAGE = 1000; let all = [], from = 0
  while (true) {
    const { data, error } = await build().range(from, from + PAGE - 1)
    if (error) throw error
    if (!data?.length) break
    all = all.concat(data); if (data.length < PAGE) break; from += PAGE
  }
  return all
}

async function resendClient() {
  const { Resend } = await import('resend')
  return new Resend(env.RESEND_API_KEY)
}

;(async () => {
  // ── 테스트 1통 ──
  if (testTo) {
    const { data: prof } = await sb.from('user_profiles').select('id, full_name').eq('email', testTo).maybeSingle()
    const uid = prof?.id || '00000000-0000-0000-0000-000000000000'
    const url = link(uid)
    const resend = await resendClient()
    const r = await resend.emails.send({ from: RESEND_FROM, to: testTo, subject: '[TEST] ' + SUBJECT, text: emailText(prof?.full_name, url), html: emailHtml(prof?.full_name, url) })
    if (r.error) throw new Error(r.error.message || 'resend_error')
    console.log(`✅ 테스트 발송 → ${testTo} (from ${RESEND_FROM}) | 링크 유저: ${uid.slice(0, 8)}… | id=${r.data?.id}`)
    console.log(`   버튼 URL: ${url}`)
    console.log(`   ⚠️ go-public 배포 전이면 버튼은 prod에서 404. 배포 후 동작.`)
    return
  }

  // ── 코호트 추출 ──
  let q = () => sb.from('user_profiles')
    .select('id, email, full_name, resume_platform, resume_source, updated_at')
    .not('resume_url', 'is', null).eq('is_resume_public', false).not('email', 'is', null)
    .order('updated_at', { ascending: false })
  if (source) { const base = q; q = () => base().eq('resume_source', source) }
  if (platform) { const base = q; q = () => base().eq('resume_platform', platform) }

  let rows = (await fetchAll(q)).filter(r => r.email && !EXCLUDED.some(d => r.email.toLowerCase().endsWith('@' + d)))

  // 이미 이 캠페인으로 발송된 유저 제외(재실행 idempotent)
  const sentEvts = await fetchAll(() => sb.from('events').select('user_id, meta').eq('event', 'coldmail_public_sent'))
  const alreadySent = new Set(sentEvts.filter(e => (e.meta?.campaign || 'coldmail1') === campaign).map(e => e.user_id))
  rows = rows.filter(r => !alreadySent.has(r.id))
  if (limit) rows = rows.slice(0, parseInt(limit))
  const capped = max ? rows.slice(0, parseInt(max)) : rows

  console.log(`캠페인: ${campaign} | 대상: ${rows.length}명${source ? ` (source=${source})` : ''}${max ? ` | 이번 발송: ${capped.length}` : ''}${alreadySent.size ? ` | 이미 발송 제외: ${alreadySent.size}` : ''}`)
  console.log(`샘플:`, rows.slice(0, 3).map(r => ({ email: r.email, name: r.full_name })))

  // CSV 백업(메일머지용/기록용)
  const lines = [['email', 'name', 'platform', 'public_link'].join(',')]
  for (const r of rows) lines.push([r.email, r.full_name || '', r.resume_platform || '', link(r.id)].map(csvCell).join(','))
  const outPath = out.replace(/^~/, process.env.HOME || '')
  writeFileSync(outPath, lines.join('\n'))
  console.log(`CSV 저장: ${outPath} (${rows.length}행)`)

  if (!doSend) {
    console.log('\n[dry-run] 발송 안 함. --send 로 Resend(hello@salary-fyi.com) 실발송 + coldmail_public_sent 스탬프.')
    return
  }

  // ── 실발송(Resend) + 성공 시 스탬프 ──
  const resend = await resendClient()
  let ok = 0, fail = 0
  for (const r of capped) {
    const url = link(r.id)
    try {
      const resp = await resend.emails.send({ from: RESEND_FROM, to: r.email, subject: SUBJECT, text: emailText(r.full_name, url), html: emailHtml(r.full_name, url) })
      if (resp.error) throw new Error(resp.error.message || 'resend_error')
      await sb.from('events').insert([{ event: 'coldmail_public_sent', page: '/campaign/resume-public', meta: { campaign, email: r.email, platform: r.resume_platform || null }, user_id: r.id }])
      ok++
    } catch (e) {
      fail++
      console.error(`  ✗ ${r.email}: ${e.message}`)
    }
    await sleep(600) // Resend rate limit 2req/s → 간격 ≥500ms 유지
  }
  console.log(`\n✅ 발송 완료: 성공 ${ok} / 실패 ${fail} (캠페인 ${campaign})`)
  if (max && rows.length > capped.length) console.log(`   남은 ${rows.length - capped.length}명은 다시 실행하면 이어서 발송됨(idempotent).`)
})().catch(e => { console.error(e); process.exit(1) })
