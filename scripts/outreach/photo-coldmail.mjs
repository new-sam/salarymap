// 사진 없는 인재 → "사진 있는 프로필이 열람·오퍼 확률 60% ↑" 사진 등록 콜드메일(베트남어).
// 발신: Resend(hello@salary-fyi.com). 원클릭 토큰 랜딩(/photo-upload)에서 로그인 없이 업로드.
// 60% 수치는 유저(대표) 확정 캠페인 카피 — 캠페인 표면에만 사용.
//
//   node scripts/outreach/photo-coldmail.mjs                          # dry-run: 대상 수/샘플/CSV
//   node scripts/outreach/photo-coldmail.mjs --test wsj@likelion.net  # 테스트 1통(스탬프 안 함)
//   node scripts/outreach/photo-coldmail.mjs --send                   # 실발송 + coldmail_photo_sent 스탬프
//   node scripts/outreach/photo-coldmail.mjs --remind --send          # 재발송: photo1·photo2 수신·아직 사진 없음(기본 캠페인 photo-remind1)
//   옵션: --limit N · --max N · --campaign photo1 · --include-today(오늘 다른 콜드메일 수신자도 포함)
//
// ⚠️ 랜딩(/photo-upload)+API(photo-claim) 배포 후에만 버튼이 동작한다.
import { writeFileSync } from 'node:fs'
import { sb, env } from './lib.mjs'
import { makeToken } from '../../lib/campaignToken.js'

const SITE = (env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com').replace(/\/$/, '')
const RESEND_FROM = env.RESEND_FROM || 'FYI <hello@salary-fyi.com>'
const EXCLUDED = ['likelion.net']
const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d }
const doSend = args.includes('--send')
const remind = args.includes('--remind')
const includeToday = args.includes('--include-today')
const testTo = flag('test', null)
const campaign = flag('campaign', remind ? 'photo-remind1' : 'photo1')
const REMIND_SOURCE = ['photo1', 'photo2'] // 재발송 소스 코호트 — photo3(신규 계열)은 제외
const limit = flag('limit', null)
const max = flag('max', null)
const out = flag('out', `./photo-coldmail-${campaign}.csv`)

const link = (userId) => `${SITE}/photo-upload?t=${makeToken(userId, campaign)}`
const unsubLink = (userId) => `${SITE}/api/coldmail/unsub?t=${makeToken(userId, campaign)}`
const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const esc = (s) => String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))

// ── 베트남어 이메일 ──
// 프레임(유저 확정): 담당자가 오퍼 1차 대기 리스트에 올렸다가 "프로필 사진 없음" 사유로 제외 —
// 실제 추천 명단 운영에서 사진 없는 프로필이 제외되는 프로세스를 반영한 카피(캠페인 표면 전용).
const SUBJECT = 'Bạn đã vào danh sách chờ nhận offer — nhưng chưa được chọn (lý do: thiếu ảnh hồ sơ)'
function emailText(name, url, unsub) {
  return `Chào ${name || 'bạn'},

Gần đây, một nhà tuyển dụng đã đưa hồ sơ của bạn vào danh sách chờ (vòng 1) để gửi offer. Nhưng rất tiếc, bạn đã không được chọn vào danh sách cuối cùng.

Lý do: hồ sơ của bạn chưa có ảnh đại diện.

Các nhà tuyển dụng thường loại những hồ sơ không có ảnh khỏi danh sách đề cử. Để không bỏ lỡ cơ hội tiếp theo, hãy thêm ảnh hồ sơ ngay — chưa đến 1 phút, không cần đăng nhập. Hồ sơ có ảnh có khả năng nhận offer cao hơn 62%:
${url}

Chọn 1 ảnh chân dung rõ mặt — ảnh sẽ được cập nhật ngay và áp dụng từ danh sách đề cử tiếp theo.

— Đội ngũ FYI (salary-fyi.com)
Hủy nhận email: ${unsub}`
}
function emailHtml(name, url, unsub) {
  return `<!doctype html><html><body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1612">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
  <div style="font-size:20px;font-weight:800;color:#ff6000;margin-bottom:20px">FYI</div>
  <div style="background:#fff;border:1px solid #eee5da;border-radius:18px;padding:30px 26px">
    <p style="font-size:15px;margin:0 0 14px">Chào <b>${esc(name) || 'bạn'}</b>,</p>
    <p style="font-size:14.5px;line-height:1.6;margin:0 0 14px">Gần đây, một nhà tuyển dụng đã đưa hồ sơ của bạn vào <b>danh sách chờ (vòng 1)</b> để gửi offer. Nhưng rất tiếc, bạn đã <b style="color:#d92d20">không được chọn</b> vào danh sách cuối cùng.</p>
    <p style="font-size:14.5px;line-height:1.6;margin:0 0 14px">Lý do: hồ sơ của bạn <b>chưa có ảnh đại diện</b>.</p>
    <p style="font-size:14.5px;line-height:1.6;margin:0 0 20px">Các nhà tuyển dụng thường loại những hồ sơ không có ảnh khỏi danh sách đề cử. Để không bỏ lỡ cơ hội tiếp theo, hãy thêm ảnh hồ sơ ngay — <b>chưa đến 1 phút</b>, không cần đăng nhập. Hồ sơ có ảnh có khả năng nhận offer cao hơn <b>62%</b>.</p>
    <div style="text-align:center;margin:0 0 20px">
      <a href="${url}" style="display:inline-block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 28px;border-radius:12px">Thêm ảnh trong 1 phút →</a>
    </div>
    <p style="font-size:13px;line-height:1.6;color:#8a8073;margin:0">Chọn 1 ảnh chân dung rõ mặt — ảnh sẽ được cập nhật ngay và áp dụng từ danh sách đề cử tiếp theo.</p>
  </div>
  <p style="font-size:11.5px;color:#a89f92;text-align:center;margin:18px 0 0;line-height:1.5">— Đội ngũ FYI · salary-fyi.com<br><a href="${unsub}" style="color:#a89f92">Hủy nhận email</a></p>
</div></body></html>`
}

// ── 재발송(photo-remind1) — 사회적 증거: "그때 사진 올린 사람들은 3일 안에 오퍼 1~2건 받았다"(유저 확정 카피)
// + "당장 이직 생각 없어도 오퍼·면접 = 시장가치 확인" 카운터 앵글.
const REMIND_SUBJECT = 'Những người đã thêm ảnh hồ sơ nhận được 1–2 offer chỉ trong 3 ngày'
function remindText(name, url, unsub) {
  return `Chào ${name || 'bạn'},

Lần trước, chúng tôi đã thông báo rằng hồ sơ của bạn bị loại khỏi danh sách đề cử nhận offer vì chưa có ảnh đại diện.

Kể từ đó, hầu hết những người đã thêm ảnh hồ sơ đều nhận được 1–2 offer từ nhà tuyển dụng chỉ trong vòng 3 ngày.

Chưa có kế hoạch chuyển việc ngay? Không sao cả. Nhận offer và trải nghiệm phỏng vấn cũng là cơ hội tốt để kiểm tra giá trị của bạn trên thị trường tuyển dụng và phát triển sự nghiệp.

Thêm ảnh chỉ mất chưa đến 1 phút, không cần đăng nhập:
${url}

Chọn 1 ảnh chân dung rõ mặt — ảnh sẽ được áp dụng ngay từ danh sách đề cử tiếp theo.

— Đội ngũ FYI (salary-fyi.com)
Hủy nhận email: ${unsub}`
}
function remindHtml(name, url, unsub) {
  return `<!doctype html><html><body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1612">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
  <div style="font-size:20px;font-weight:800;color:#ff6000;margin-bottom:20px">FYI</div>
  <div style="background:#fff;border:1px solid #eee5da;border-radius:18px;padding:30px 26px">
    <p style="font-size:15px;margin:0 0 14px">Chào <b>${esc(name) || 'bạn'}</b>,</p>
    <p style="font-size:14.5px;line-height:1.6;margin:0 0 14px">Lần trước, chúng tôi đã thông báo rằng hồ sơ của bạn bị loại khỏi danh sách đề cử nhận offer vì <b>chưa có ảnh đại diện</b>.</p>
    <p style="font-size:14.5px;line-height:1.6;margin:0 0 14px">Kể từ đó, hầu hết những người đã thêm ảnh hồ sơ đều nhận được <b>1–2 offer</b> từ nhà tuyển dụng <b>chỉ trong vòng 3 ngày</b>.</p>
    <p style="font-size:14.5px;line-height:1.6;margin:0 0 20px">Chưa có kế hoạch chuyển việc ngay? Không sao cả. Nhận offer và trải nghiệm phỏng vấn cũng là cơ hội tốt để kiểm tra giá trị của bạn trên thị trường tuyển dụng và phát triển sự nghiệp.</p>
    <p style="font-size:14.5px;line-height:1.6;margin:0 0 14px">Thêm ảnh chỉ mất <b>chưa đến 1 phút</b>, không cần đăng nhập:</p>
    <div style="text-align:center;margin:0 0 20px">
      <a href="${url}" style="display:inline-block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 28px;border-radius:12px">Thêm ảnh trong 1 phút →</a>
    </div>
    <p style="font-size:13px;line-height:1.6;color:#8a8073;margin:0">Chọn 1 ảnh chân dung rõ mặt — ảnh sẽ được áp dụng ngay từ danh sách đề cử tiếp theo.</p>
  </div>
  <p style="font-size:11.5px;color:#a89f92;text-align:center;margin:18px 0 0;line-height:1.5">— Đội ngũ FYI · salary-fyi.com<br><a href="${unsub}" style="color:#a89f92">Hủy nhận email</a></p>
</div></body></html>`
}

const activeSubject = remind ? REMIND_SUBJECT : SUBJECT
const activeText = remind ? remindText : emailText
const activeHtml = remind ? remindHtml : emailHtml

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
    const resend = await resendClient()
    const r = await resend.emails.send({ from: RESEND_FROM, to: testTo, subject: '[TEST] ' + activeSubject, text: activeText(prof?.full_name, link(uid), unsubLink(uid)), html: activeHtml(prof?.full_name, link(uid), unsubLink(uid)) })
    if (r.error) throw new Error(r.error.message || 'resend_error')
    console.log(`✅ 테스트 발송 → ${testTo} | 링크 유저: ${uid.slice(0, 8)}… | id=${r.data?.id}`)
    console.log(`   버튼 URL: ${link(uid)}`)
    console.log(`   ⚠️ /photo-upload 배포 전이면 버튼은 prod에서 404.`)
    return
  }

  // ── 코호트: 이력서 보유 + 사진 없음 + 이메일 보유 ──
  let rows = await fetchAll(() => sb.from('user_profiles')
    .select('id, email, full_name, updated_at')
    .not('resume_url', 'is', null).neq('resume_url', '')
    .is('photo_url', null).not('email', 'is', null)
    .order('updated_at', { ascending: false }))
  rows = rows.filter(r => r.email && !EXCLUDED.some(d => r.email.toLowerCase().endsWith('@' + d)))

  // 수신거부 제외 (회원 콜드메일 공용 마커)
  const unsubs = await fetchAll(() => sb.from('events').select('user_id').eq('event', 'coldmail_unsub'))
  const unsubSet = new Set(unsubs.map(e => e.user_id).filter(Boolean))
  rows = rows.filter(r => !unsubSet.has(r.id))

  // 발송 이력 — 1000행 넘어 페이지네이션 구간이라 order 필수(정렬 없으면 행 누락/중복)
  const sentEvts = await fetchAll(() => sb.from('events').select('user_id, meta').eq('event', 'coldmail_photo_sent').order('created_at', { ascending: true }))
  let excludedLabel
  if (remind) {
    // 재발송: photo1·photo2 수신자 중 아직 사진 없는 사람만. photo3 등 신규 계열 수신자는 소스에서
    // 제외(당일 발송과 겹치면 하루 2통). 이 캠페인 기수신자 제외로 재실행 idempotent.
    const source = new Set(sentEvts.filter(e => REMIND_SOURCE.includes(e.meta?.campaign)).map(e => e.user_id))
    const alreadyThis = new Set(sentEvts.filter(e => e.meta?.campaign === campaign).map(e => e.user_id))
    rows = rows.filter(r => source.has(r.id) && !alreadyThis.has(r.id))
    excludedLabel = `소스(${REMIND_SOURCE.join('·')}): ${source.size} | 이 캠페인 기발송 제외: ${alreadyThis.size}`
  } else {
    // 캠페인 무관 전체 제외 — 8/6 코호트를 photo2로 분리한 뒤라, 캠페인별로 거르면 photo1 재실행 시 재발송된다.
    const alreadySent = new Set(sentEvts.map(e => e.user_id))
    rows = rows.filter(r => !alreadySent.has(r.id))
    excludedLabel = `기발송 제외: ${alreadySent.size}`
  }

  // 오늘(ICT) 다른 콜드메일 수신자 제외 — 하루 1통 원칙(--include-today 로 해제)
  let todayExcluded = 0
  if (!includeToday) {
    const now = new Date(); now.setUTCHours(now.getUTCHours() + 7); now.setUTCHours(0, 0, 0, 0)
    const todayStart = new Date(now.getTime() - 7 * 3600e3).toISOString()
    const todaySent = await fetchAll(() => sb.from('events').select('user_id').ilike('event', 'coldmail%_sent').gte('created_at', todayStart))
    const todaySet = new Set(todaySent.map(e => e.user_id).filter(Boolean))
    const before = rows.length
    rows = rows.filter(r => !todaySet.has(r.id))
    todayExcluded = before - rows.length
  }

  if (limit) rows = rows.slice(0, parseInt(limit))
  const capped = max ? rows.slice(0, parseInt(max)) : rows

  console.log(`캠페인: ${campaign}${remind ? ' (재발송)' : ''} | 대상: ${rows.length}명${max ? ` | 이번 발송: ${capped.length}` : ''} | ${excludedLabel} | 수신거부 제외: ${unsubSet.size}${includeToday ? '' : ` | 오늘 수신자 제외: ${todayExcluded}`}`)
  console.log('샘플:', rows.slice(0, 3).map(r => ({ email: r.email, name: r.full_name })))

  const lines = [['email', 'name', 'upload_link'].join(',')]
  for (const r of rows) lines.push([r.email, r.full_name || '', link(r.id)].map(csvCell).join(','))
  writeFileSync(out.replace(/^~/, process.env.HOME || ''), lines.join('\n'))
  console.log(`CSV 저장: ${out} (${rows.length}행)`)

  if (!doSend) {
    console.log('\n[dry-run] 발송 안 함. --send 로 Resend 실발송 + coldmail_photo_sent 스탬프.')
    return
  }

  const resend = await resendClient()
  let ok = 0, fail = 0
  for (const r of capped) {
    try {
      const resp = await resend.emails.send({ from: RESEND_FROM, to: r.email, subject: activeSubject, text: activeText(r.full_name, link(r.id), unsubLink(r.id)), html: activeHtml(r.full_name, link(r.id), unsubLink(r.id)) })
      if (resp.error) throw new Error(resp.error.message || 'resend_error')
      await sb.from('events').insert([{ event: 'coldmail_photo_sent', page: '/campaign/photo', meta: { campaign, email: r.email }, user_id: r.id }])
      ok++
    } catch (e) {
      fail++
      console.error(`  ✗ ${r.email}: ${e.message}`)
    }
    await sleep(600) // Resend rate limit 2req/s
  }
  console.log(`\n✅ 발송 완료: 성공 ${ok} / 실패 ${fail} (캠페인 ${campaign})`)
  if (max && rows.length > capped.length) console.log(`   남은 ${rows.length - capped.length}명은 재실행 시 이어서 발송(idempotent).`)
})().catch(e => { console.error(e); process.exit(1) })
