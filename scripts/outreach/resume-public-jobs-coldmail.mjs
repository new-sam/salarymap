// 그냥 미공개로 둔 이력서 보유자(축하금 이벤트 /cv 등록자 제외) → "기업들이 적극 채용중,
// 공개하고 원탭 지원하세요" 콜드메일(베트남어). 버튼 = go-public 원클릭 공개 전환 →
// jobs 캠페인 랜딩(기업등록 공고 리스트 + 원탭 지원). 발신: Resend hello@salary-fyi.com.
//
//   node scripts/outreach/resume-public-jobs-coldmail.mjs                        # dry-run: 대상 수/샘플/CSV
//   node scripts/outreach/resume-public-jobs-coldmail.mjs --test wsj@likelion.net # 테스트 1통(스탬프 안 함)
//   node scripts/outreach/resume-public-jobs-coldmail.mjs --send                 # 실발송 + coldmail_public_sent 스탬프
//   옵션: --platform web|app · --limit N · --max N(한 번에 N명) · --campaign jobs1
//
// 코호트: resume_url 있음 + is_resume_public=false + resume_source != 'cv'(축하금 이벤트 제외).
// ⚠️ 캠페인명은 반드시 jobs* 로 — go-public이 이 접두사로 공고 리스트 랜딩을 분기한다.
// ⚠️ 토큰 시크릿(RESUME_PUBLIC_TOKEN_SECRET, 없으면 소스 기본값)은 로컬·prod 동일해야 하고,
//    go-public jobs 분기 + quick-apply가 배포된 후에만 버튼/지원이 동작한다.
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
const campaign = flag('campaign', 'jobs1')
const platform = flag('platform', null)
const limit = flag('limit', null)
const max = flag('max', null)
const out = flag('out', `./resume-public-${campaign}.csv`)

if (!/^jobs/.test(campaign)) { console.error(`캠페인명은 jobs* 여야 랜딩이 공고 리스트로 분기됩니다: ${campaign}`); process.exit(1) }

const link = (userId) => `${SITE}/api/resume/go-public?t=${makeToken(userId, campaign)}`
const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const esc = (s) => String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))

// ── 이메일에 보여줄 상위 공고(기업 직접등록 · 활성 · 지원 많은 순) ──
async function topJobs(n = 5) {
  const { data: jobs, error } = await sb.from('jobs')
    .select('id, title, company, created_at')
    .eq('source', 'company_self').eq('is_active', true)
    .not('company', 'ilike', '%likelion%')
  if (error) throw error
  const { data: apps } = await sb.from('job_applications').select('job_id').in('job_id', jobs.map(j => j.id))
  const counts = {}
  for (const a of apps || []) counts[a.job_id] = (counts[a.job_id] || 0) + 1
  const sorted = jobs.sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0) || new Date(b.created_at) - new Date(a.created_at))
  return { top: sorted.slice(0, n), total: sorted.length }
}

// ── 베트남어 이메일 — 축하금이 아니라 "적극 채용중 기업 + 원탭 지원" 앵글 ──
const SUBJECT = 'Các công ty này đang tuyển dụng tích cực — nhưng CV của bạn đang bị ẩn'
function emailText(name, url, jobs, total) {
  const list = jobs.map(j => `• ${j.title} — ${j.company}`).join('\n')
  return `Chào ${name || 'bạn'},

Bạn đã đăng ký CV trên FYI, nhưng CV đang ở chế độ RIÊNG TƯ — nhà tuyển dụng không thể tìm thấy bạn.

Trong khi đó, ${total} vị trí từ các công ty đang tuyển dụng tích cực trên FYI ngay lúc này:
${list}
…và nhiều vị trí khác.

Chỉ cần 1 chạm để công khai CV và ứng tuyển ngay:
${url}

Sau khi công khai, bạn có thể ứng tuyển từng vị trí chỉ với 1 nút bấm — CV đã đăng ký sẽ được gửi tự động, không cần điền lại thông tin.

— Đội ngũ FYI (salary-fyi.com)
Đây là email tự động. Nếu bạn không muốn công khai CV, chỉ cần bỏ qua email này.`
}
function emailHtml(name, url, jobs, total) {
  const rows = jobs.map(j => `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #f3ede4">
      <div style="font-size:14px;font-weight:700;color:#1a1612;line-height:1.4">${esc(j.title)}</div>
      <div style="font-size:12.5px;color:#8a8073;margin-top:2px">${esc(j.company)}</div>
    </td></tr>`).join('')
  return `<!doctype html><html><body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1612">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
  <div style="font-size:20px;font-weight:800;color:#ff6000;margin-bottom:20px">FYI</div>
  <div style="background:#fff;border:1px solid #eee5da;border-radius:18px;padding:30px 26px">
    <p style="font-size:15px;margin:0 0 14px">Chào <b>${esc(name) || 'bạn'}</b>,</p>
    <p style="font-size:14.5px;line-height:1.6;margin:0 0 16px">Bạn đã đăng ký CV trên FYI, nhưng CV đang ở chế độ <b style="color:#d92d20">RIÊNG TƯ</b> — nhà tuyển dụng <b>không thể tìm thấy bạn</b>.</p>
    <p style="font-size:14.5px;line-height:1.6;margin:0 0 10px">Trong khi đó, <b>${total} vị trí</b> từ các công ty đang tuyển dụng tích cực trên FYI ngay lúc này:</p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 18px">${rows}</table>
    <p style="font-size:14.5px;line-height:1.6;margin:0 0 20px">Chỉ cần <b>1 chạm</b> để công khai CV và ứng tuyển ngay:</p>
    <div style="text-align:center;margin:0 0 22px">
      <a href="${url}" style="display:inline-block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 28px;border-radius:12px">Công khai CV &amp; xem việc làm →</a>
    </div>
    <p style="font-size:13px;line-height:1.6;color:#8a8073;margin:0">Sau khi công khai, bạn có thể ứng tuyển từng vị trí chỉ với 1 nút bấm — CV đã đăng ký sẽ được gửi tự động, không cần điền lại thông tin.</p>
  </div>
  <p style="font-size:11.5px;color:#a89f92;text-align:center;margin:18px 0 0;line-height:1.5">— Đội ngũ FYI · salary-fyi.com<br>Đây là email tự động. Nếu bạn không muốn công khai CV, chỉ cần bỏ qua email này.</p>
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
  const { top, total } = await topJobs(5)
  console.log(`이메일 공고 미리보기(${total}개 중 상위 5):`, top.map(j => `${j.title} — ${j.company}`))

  // ── 테스트 1통 ──
  if (testTo) {
    const { data: prof } = await sb.from('user_profiles').select('id, full_name').eq('email', testTo).maybeSingle()
    const uid = prof?.id || '00000000-0000-0000-0000-000000000000'
    const url = link(uid)
    const resend = await resendClient()
    const r = await resend.emails.send({ from: RESEND_FROM, to: testTo, subject: '[TEST] ' + SUBJECT, text: emailText(prof?.full_name, url, top, total), html: emailHtml(prof?.full_name, url, top, total) })
    if (r.error) throw new Error(r.error.message || 'resend_error')
    console.log(`✅ 테스트 발송 → ${testTo} (from ${RESEND_FROM}) | 링크 유저: ${uid.slice(0, 8)}… | id=${r.data?.id}`)
    console.log(`   버튼 URL: ${url}`)
    console.log(`   ⚠️ go-public jobs 분기 + quick-apply 배포 전이면 랜딩/지원이 동작 안 함.`)
    return
  }

  // ── 코호트 추출: 미공개 + 축하금 이벤트(/cv 등록) 제외 ──
  let q = () => sb.from('user_profiles')
    .select('id, email, full_name, resume_platform, resume_source, updated_at')
    .not('resume_url', 'is', null).eq('is_resume_public', false).not('email', 'is', null)
    .or('resume_source.neq.cv,resume_source.is.null')
    .order('updated_at', { ascending: false })
  if (platform) { const base = q; q = () => base().eq('resume_platform', platform) }

  let rows = (await fetchAll(q)).filter(r => r.email && !EXCLUDED.some(d => r.email.toLowerCase().endsWith('@' + d)))

  // 이미 이 캠페인으로 발송된 유저 제외(재실행 idempotent)
  const sentEvts = await fetchAll(() => sb.from('events').select('user_id, meta').eq('event', 'coldmail_public_sent'))
  const alreadySent = new Set(sentEvts.filter(e => (e.meta?.campaign || 'coldmail1') === campaign).map(e => e.user_id))
  rows = rows.filter(r => !alreadySent.has(r.id))
  if (limit) rows = rows.slice(0, parseInt(limit))
  const capped = max ? rows.slice(0, parseInt(max)) : rows

  console.log(`캠페인: ${campaign} | 대상: ${rows.length}명 (미공개·/cv 제외)${max ? ` | 이번 발송: ${capped.length}` : ''}${alreadySent.size ? ` | 이미 발송 제외: ${alreadySent.size}` : ''}`)
  console.log(`샘플:`, rows.slice(0, 3).map(r => ({ email: r.email, name: r.full_name, source: r.resume_source })))

  // CSV 백업(기록용)
  const lines = [['email', 'name', 'source', 'platform', 'public_link'].join(',')]
  for (const r of rows) lines.push([r.email, r.full_name || '', r.resume_source || '', r.resume_platform || '', link(r.id)].map(csvCell).join(','))
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
      const resp = await resend.emails.send({ from: RESEND_FROM, to: r.email, subject: SUBJECT, text: emailText(r.full_name, url, top, total), html: emailHtml(r.full_name, url, top, total) })
      if (resp.error) throw new Error(resp.error.message || 'resend_error')
      await sb.from('events').insert([{ event: 'coldmail_public_sent', page: '/campaign/resume-public', meta: { campaign, email: r.email, source: r.resume_source || null, platform: r.resume_platform || null }, user_id: r.id }])
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
