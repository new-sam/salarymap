// 일회성: 이제까지의 전체 지원자에게 유사공고 추천 메일 즉시 발송.
// pages/api/admin/similar-recommend.js 의 computeMatches/composeEmail 과 동일 로직
// (그 파일은 extensionless import라 node로 직접 못 불러 여기 복제).
// 중복발송은 job_recommendations (user_id/email + job_id) 기록으로 제외되므로 재실행 안전.
//
//   node scripts/send-similar-blast.mjs           → dry-run: 매칭 집계만 출력
//   node scripts/send-similar-blast.mjs --send    → 실제 발송 + job_recommendations 기록
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// .env.local 로드
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const SITE_URL = 'https://salary-fyi.com'
const RESEND_FROM = process.env.RESEND_FROM || 'FYI <onboarding@resend.dev>'
const MAX_JOBS_PER_EMAIL = 6
const SEND = process.argv.includes('--send')

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

const T = {
  fallbackName: 'bạn',
  subject: (n) => `[FYI] ${n} việc làm tương tự công việc bạn vừa ứng tuyển`,
  eyebrow: 'Gợi ý việc làm',
  intro: (ref, name) => `Chào ${name}, dựa trên công việc bạn vừa ứng tuyển (${ref}), chúng tôi tìm thấy các vị trí tương tự với khả năng trúng tuyển cao:`,
  note: 'Các vị trí này phù hợp với hồ sơ ứng tuyển gần đây của bạn — hãy ứng tuyển sớm để được ưu tiên xét duyệt.',
  cta: 'Xem & ứng tuyển →',
  footer: 'Đây là email tự động từ FYI (salary-fyi.com). Vui lòng không trả lời trực tiếp.',
}

function jobLink(id) {
  return `${SITE_URL}/jobs/${id}?utm_source=fyi&utm_medium=email&utm_campaign=similar_jobs`
}

function composeEmail({ name, appliedTitle, appliedCompany, jobs }) {
  const who = name || T.fallbackName
  const refText = appliedCompany ? `${appliedTitle} · ${appliedCompany}` : appliedTitle
  const refHtml = `<b style="color:#111">${escapeHtml(appliedTitle)}</b>${appliedCompany ? ` · ${escapeHtml(appliedCompany)}` : ''}`
  const subject = T.subject(jobs.length)

  const text =
`${T.intro(refText, who)}

${jobs.map(j => `■ ${j.title}${j.company ? ` (${j.company})` : ''}\n${jobLink(j.id)}`).join('\n\n')}

${T.note}

— FYI (salary-fyi.com)`

  const cards = jobs.map(j => {
    const initial = escapeHtml((j.company || j.title || '?').trim()[0] || '?')
    const logo = j.logo_url
      ? `<img src="${escapeHtml(j.logo_url)}" alt="" width="40" height="40" style="width:40px;height:40px;border-radius:9px;object-fit:contain;background:#fff;border:1px solid #eef0f3;display:block">`
      : `<div style="width:40px;height:40px;border-radius:9px;background:#fff1e7;color:#ea580c;font-size:17px;font-weight:800;text-align:center;line-height:40px">${initial}</div>`
    return `<a href="${jobLink(j.id)}" style="text-decoration:none;color:inherit;display:block">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fafbfc;border:1px solid #edf0f3;border-radius:12px;margin:0 0 10px">
        <tr>
          <td style="padding:14px 6px 14px 14px;width:40px;vertical-align:middle">${logo}</td>
          <td style="padding:14px 8px 14px 12px;vertical-align:middle">
            <div style="font-size:15px;font-weight:800;color:#111;line-height:1.35">${escapeHtml(j.title)}</div>
            <div style="font-size:12.5px;color:#6b7280;margin-top:2px">${escapeHtml(j.company || '')}</div>
          </td>
          <td style="padding:14px 16px 14px 8px;vertical-align:middle;text-align:right;white-space:nowrap">
            <span style="color:#ea580c;font-size:13px;font-weight:800">${escapeHtml(T.cta)}</span>
          </td>
        </tr>
      </table></a>`
  }).join('')

  const html =
`<div style="background:#f4f5f8;padding:32px 16px;font-family:'Pretendard','Segoe UI',Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px">
      <tr><td style="background:#17181c;border-radius:16px 16px 0 0;padding:18px 30px">
        <img src="${SITE_URL}/logo.png" alt="FYI" height="28" style="height:28px;display:block">
      </td></tr>
      <tr><td style="background:#ffffff;border:1px solid #e9ecf0;border-top:none;border-radius:0 0 16px 16px;padding:30px 30px 34px">
        <div style="font-size:11px;font-weight:800;letter-spacing:1.5px;color:#ea580c;text-transform:uppercase;margin-bottom:10px">${escapeHtml(T.eyebrow)}</div>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#4b5563">${T.intro(refHtml, `<b style="color:#111">${escapeHtml(who)}</b>`)}</p>
        ${cards}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 0">
          <tr><td style="background:#fff7ed;border-left:3px solid #ea580c;border-radius:0 8px 8px 0;padding:13px 16px;font-size:13.5px;line-height:1.6;color:#7c2d12">${escapeHtml(T.note)}</td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:20px 6px;text-align:center;font-size:12px;line-height:1.6;color:#9ca3af">
        ${escapeHtml(T.footer)}<br>
        <a href="${SITE_URL}" style="color:#9ca3af;text-decoration:underline">salary-fyi.com</a>
      </td></tr>
    </table>
  </td></tr></table>
</div>`
  return { subject, text, html }
}

// ── 매칭 (admin/similar-recommend.js computeMatches와 동일, cutoff 없이 전체 지원자) ──
async function computeMatches() {
  const PAGE = 1000
  let apps = []
  for (let offset = 0; ; offset += PAGE) {
    const { data: page, error } = await supabase
      .from('job_applications')
      .select('job_id, user_id, applicant_email, applicant_name, created_at, jobs(role, title, company)')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!page?.length) break
    apps = apps.concat(page)
    if (page.length < PAGE) break
  }
  console.log(`지원 이력: ${apps.length}건`)

  const { data: companyJobs, error: jobErr } = await supabase
    .from('jobs')
    .select('id, title, company, role, logo_url')
    .eq('source', 'company_self')
    .eq('is_active', true)
  if (jobErr) throw new Error(jobErr.message)
  console.log(`활성 기업등록 공고: ${companyJobs.length}건`)
  const jobsByRole = {}
  for (const j of companyJobs) {
    if (!j.role) continue
    ;(jobsByRole[j.role] = jobsByRole[j.role] || []).push(j)
  }

  const { data: sent, error: sentErr } = await supabase
    .from('job_recommendations')
    .select('user_id, to_email, job_id')
  if (sentErr) throw new Error(sentErr.message)
  const sentKeys = new Set()
  for (const r of sent || []) {
    if (r.user_id) sentKeys.add(`u:${r.user_id}|${r.job_id}`)
    if (r.to_email) sentKeys.add(`e:${r.to_email.toLowerCase()}|${r.job_id}`)
  }

  const byApplicant = new Map()
  for (const a of apps) {
    const email = (a.applicant_email || '').trim().toLowerCase()
    const key = a.user_id ? `u:${a.user_id}` : (email ? `e:${email}` : null)
    if (!key) continue
    let g = byApplicant.get(key)
    if (!g) {
      g = { user_id: a.user_id || null, email: a.applicant_email || null, name: a.applicant_name || null,
            roles: new Set(), appliedJobIds: new Set(), recent: null }
      byApplicant.set(key, g)
    }
    if (!g.email && a.applicant_email) g.email = a.applicant_email
    if (!g.name && a.applicant_name) g.name = a.applicant_name
    if (a.job_id) g.appliedJobIds.add(a.job_id)
    if (a.jobs?.role) g.roles.add(a.jobs.role)
    if (!g.recent && a.jobs) g.recent = { title: a.jobs.title, company: a.jobs.company }
  }
  console.log(`고유 지원자: ${byApplicant.size}명`)

  const result = []
  for (const g of byApplicant.values()) {
    if (!g.email) continue
    const seen = new Set()
    const jobs = []
    for (const role of g.roles) {
      for (const j of jobsByRole[role] || []) {
        if (seen.has(j.id)) continue
        if (g.appliedJobIds.has(j.id)) continue
        const k1 = g.user_id ? `u:${g.user_id}|${j.id}` : null
        const k2 = `e:${g.email.toLowerCase()}|${j.id}`
        if ((k1 && sentKeys.has(k1)) || sentKeys.has(k2)) continue
        seen.add(j.id)
        jobs.push(j)
      }
    }
    if (!jobs.length) continue
    result.push({
      user_id: g.user_id, email: g.email, name: g.name,
      applied: g.recent || { title: '', company: '' },
      jobs: jobs.slice(0, MAX_JOBS_PER_EMAIL),
    })
  }
  result.sort((a, b) => b.jobs.length - a.jobs.length)
  return result
}

// ── 실행 ──
const matched = await computeMatches()
const internal = matched.filter(t => t.email.toLowerCase().endsWith('@likelion.net'))
const targets = matched.filter(t => !t.email.toLowerCase().endsWith('@likelion.net'))
if (internal.length) console.log(`내부(@likelion.net) 제외: ${internal.length}명`)
console.log(`\n발송 대상: ${targets.length}명 (이미 발송/이미 지원 제외 후)`)
const dist = {}
for (const t of targets) dist[t.jobs.length] = (dist[t.jobs.length] || 0) + 1
console.log('공고 수 분포:', Object.entries(dist).map(([k, v]) => `${k}개×${v}명`).join(', '))
console.log('샘플 5명:')
for (const t of targets.slice(0, 5)) {
  console.log(`  ${t.email} (${t.name || '-'}) ← 지원: ${t.applied.title} / 추천: ${t.jobs.map(j => j.title).join(' | ')}`)
}

// --test <주소>: 매칭 1건의 실제 발송본을 해당 주소로 보내고 종료 (DB 기록 없음)
const testIdx = process.argv.indexOf('--test')
if (testIdx !== -1) {
  const to = process.argv[testIdx + 1]
  const a = targets[0] || internal[0]
  if (!to || !a) { console.log('테스트 주소 또는 매칭 대상 없음'); process.exit(1) }
  const email = composeEmail({ name: a.name, appliedTitle: a.applied.title, appliedCompany: a.applied.company, jobs: a.jobs })
  const r = await new Resend(process.env.RESEND_API_KEY).emails.send({ from: RESEND_FROM, to, subject: `[TEST] ${email.subject}`, text: email.text, html: email.html })
  if (r.error) { console.log('발송 실패:', r.error.message); process.exit(1) }
  console.log(`테스트 발송 완료 → ${to} (원수신자 ${a.email} 의 발송본, 공고 ${a.jobs.length}개)`)
  process.exit(0)
}

if (!SEND) {
  console.log('\n[dry-run] 실제 발송하려면 --send 플래그를 붙이세요.')
  process.exit(0)
}

console.log(`\n발송 시작 (from: ${RESEND_FROM})`)
const resend = new Resend(process.env.RESEND_API_KEY)
let sent = 0, failed = 0
for (const [i, a] of targets.entries()) {
  const email = composeEmail({ name: a.name, appliedTitle: a.applied.title, appliedCompany: a.applied.company, jobs: a.jobs })
  try {
    const r = await resend.emails.send({ from: RESEND_FROM, to: a.email, subject: email.subject, text: email.text, html: email.html })
    if (r.error) throw new Error(r.error.message || 'resend_error')
  } catch (e) {
    failed += 1
    console.log(`  ✗ ${a.email}: ${e.message}`)
    await new Promise(r => setTimeout(r, 700))
    continue
  }
  const rows = a.jobs.map(j => ({
    user_id: a.user_id || null, to_email: a.email, job_id: j.id,
    job_title: j.title, job_company: j.company,
    sent_by: 'blast-script', status: 'sent', kind: 'similar',
  }))
  const { error: insErr } = await supabase.from('job_recommendations').insert(rows)
  if (insErr) console.log(`  ⚠ ${a.email} 발송됨/기록실패: ${insErr.message}`)
  sent += 1
  if ((i + 1) % 25 === 0) console.log(`  … ${i + 1}/${targets.length}`)
  await new Promise(r => setTimeout(r, 700)) // Resend rate limit(2req/s) 여유
}
console.log(`\n완료: 발송 ${sent}, 실패 ${failed}`)
