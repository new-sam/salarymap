// 어학값 유실 복구 재수집(lang-recover1) — 8/5 재파싱이 어학 제출값을 덮어쓴 사고의 복구.
// 대상 = coldmail_lang_fill 이벤트가 있는데 현재 english/korean_cert 둘 다 빈 사람(확실 유실).
// 기존 /lang 랜딩·토큰 재사용. coldmail_lang_sent 는 안 남긴다(어학 A/B wave 집계 오염 방지)
// — 대신 coldmail_lang_recover_sent 로 기록. 재제출은 coldmail_lang_fill(campaign=lang-recover1)로 잡힘.
//   node scripts/lang-coldmail/resend-recover.mjs            # dry-run
//   node scripts/lang-coldmail/resend-recover.mjs --send     # 실발송
import { sb, env } from '../outreach/lib.mjs'
import { makeToken } from '../../lib/ktcMailToken.js'

const SITE = (env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com').replace(/\/$/, '')
const RESEND_FROM = env.RESEND_FROM || 'FYI <hello@salary-fyi.com>'
const CAMPAIGN = 'lang-recover1'
const doSend = process.argv.includes('--send')
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const esc = (s) => String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))

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

const SUBJECT = 'Xin lỗi — thông tin ngoại ngữ của bạn chưa được lưu, nhờ bạn nhập lại (30 giây)'
const emailText = (name, url, unsub) => `Chào ${name || 'bạn'},

Do lỗi hệ thống tạm thời, thông tin trình độ ngoại ngữ bạn đã gửi cho FYI chưa được lưu lại. Chúng tôi thành thật xin lỗi vì sự bất tiện này.

Nhờ bạn nhập lại — chỉ mất khoảng 30 giây:
${url}

Cảm ơn bạn rất nhiều!

— Đội ngũ FYI (salary-fyi.com)
Hủy nhận email: ${unsub}`
const emailHtml = (name, url, unsub) => `<!doctype html><html><body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1612">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
  <div style="font-size:20px;font-weight:800;color:#ff6000;margin-bottom:20px">FYI</div>
  <div style="background:#fff;border:1px solid #eee5da;border-radius:18px;padding:30px 26px">
    <p style="font-size:15px;margin:0 0 14px">Chào <b>${esc(name) || 'bạn'}</b>,</p>
    <p style="font-size:14.5px;line-height:1.6;margin:0 0 14px">Do lỗi hệ thống tạm thời, thông tin trình độ ngoại ngữ bạn đã gửi cho FYI <b style="color:#d92d20">chưa được lưu lại</b>. Chúng tôi thành thật xin lỗi vì sự bất tiện này.</p>
    <p style="font-size:14.5px;line-height:1.6;margin:0 0 20px">Nhờ bạn nhập lại — chỉ mất khoảng <b>30 giây</b>:</p>
    <div style="text-align:center;margin:0 0 20px">
      <a href="${url}" style="display:inline-block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 28px;border-radius:12px">Nhập lại trình độ ngoại ngữ →</a>
    </div>
    <p style="font-size:13px;line-height:1.6;color:#8a8073;margin:0">Cảm ơn bạn rất nhiều! 🙏</p>
  </div>
  <p style="font-size:11.5px;color:#a89f92;text-align:center;margin:18px 0 0;line-height:1.5">— Đội ngũ FYI · salary-fyi.com<br><a href="${unsub}" style="color:#a89f92">Hủy nhận email</a></p>
</div></body></html>`

;(async () => {
  // 대상: fill 이벤트 보유 + 현재 어학 둘 다 빈 사람
  const fills = await fetchAll(() => sb.from('events').select('user_id').eq('event', 'coldmail_lang_fill'))
  const fillIds = [...new Set(fills.map(e => e.user_id).filter(Boolean))]
  const profs = []
  for (let i = 0; i < fillIds.length; i += 100) {
    const { data } = await sb.from('user_profiles').select('id, full_name, email, english_cert, korean_cert').in('id', fillIds.slice(i, i + 100))
    profs.push(...(data || []))
  }
  // 이미 복구메일 보낸 사람 제외(멱등)
  const sent = await fetchAll(() => sb.from('events').select('user_id').eq('event', 'coldmail_lang_recover_sent'))
  const sentSet = new Set(sent.map(e => e.user_id))
  const targets = profs.filter(p => !p.english_cert && !p.korean_cert && p.email && !sentSet.has(p.id))
  console.log(`유실자(둘 다 빔) ${targets.length}명${sentSet.size ? ` | 기발송 제외 ${sentSet.size}` : ''}`)
  targets.forEach(p => console.log(' ', p.full_name, '|', p.email))
  if (!doSend) { console.log('\n[dry-run] --send 로 실발송'); return }

  const { Resend } = await import('resend')
  const resend = new Resend(env.RESEND_API_KEY)
  let ok = 0, fail = 0
  for (const p of targets) {
    const url = `${SITE}/lang?t=${encodeURIComponent(makeToken(p.email, CAMPAIGN))}&lang=vi`
    const unsub = `${SITE}/api/ktc/unsub?t=${encodeURIComponent(makeToken(p.email, CAMPAIGN))}`
    try {
      const r = await resend.emails.send({ from: RESEND_FROM, to: p.email, subject: SUBJECT, text: emailText(p.full_name, url, unsub), html: emailHtml(p.full_name, url, unsub) })
      if (r.error) throw new Error(r.error.message || 'resend_error')
      await sb.from('events').insert([{ event: 'coldmail_lang_recover_sent', user_id: p.id, meta: { campaign: CAMPAIGN, email: p.email } }])
      ok++
    } catch (e) {
      fail++
      console.error(`  ✗ ${p.email}: ${e.message}`)
    }
    await sleep(600)
  }
  console.log(`\n✅ 발송: 성공 ${ok} / 실패 ${fail}`)
})().catch(e => { console.error(e); process.exit(1) })
