import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'
import { sendPush } from '../../../lib/push'

// 유사공고 자동 추천 메일.
// 지원자(job_applications)마다 그가 지원한 직군(jobs.role)과 같은 기업등록 공고(source='company_self',
// is_active)를 모아 "최근 지원하신 공고와 비슷한 · 합격 확률 높은 공고" 메일 1통으로 발송.
// GET  : ?days=90 — 매칭 결과(지원자별 추천 공고 목록) 프리뷰. 발송 안 함.
// POST : { applicants:[{user_id,email,name,appliedTitle,appliedCompany,jobIds}], lang, preview? }
//        preview=true 면 첫 지원자 기준 실제 발송본 HTML 만 반환.
// 수신자가 베트남 구직자이므로 메일은 vi 기본 ([[talent-recommend-email]] 와 동일 관례).

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com').replace(/\/$/, '')
const RESEND_FROM = process.env.RESEND_FROM || 'FYI <onboarding@resend.dev>'
const MAX_JOBS_PER_EMAIL = 6   // 메일 하나에 담는 추천 공고 상한

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

const EMAIL_I18N = {
  vi: {
    fallbackName: 'bạn',
    subject: (n) => `[FYI] ${n} việc làm tương tự công việc bạn vừa ứng tuyển`,
    eyebrow: 'Gợi ý việc làm',
    intro: (ref, name) => `Chào ${name}, dựa trên công việc bạn vừa ứng tuyển (${ref}), chúng tôi tìm thấy các vị trí tương tự với khả năng trúng tuyển cao:`,
    note: 'Các vị trí này phù hợp với hồ sơ ứng tuyển gần đây của bạn — hãy ứng tuyển sớm để được ưu tiên xét duyệt.',
    cta: 'Xem & ứng tuyển →',
    footer: 'Đây là email tự động từ FYI (salary-fyi.com). Vui lòng không trả lời trực tiếp.',
  },
  ko: {
    fallbackName: '회원',
    subject: (n) => `[FYI] 최근 지원과 비슷한 공고 ${n}건`,
    eyebrow: '맞춤 공고 추천',
    intro: (ref, name) => `${name}님, 최근 지원하신 공고(${ref})와 비슷한, 합격 확률이 높은 공고를 찾았어요:`,
    note: '최근 지원 이력과 잘 맞는 공고예요. 서둘러 지원하면 우선 검토됩니다.',
    cta: '공고 보고 지원하기 →',
    footer: '본 메일은 FYI(salary-fyi.com)에서 자동 발송되었습니다. 직접 회신하지 마세요.',
  },
  en: {
    fallbackName: 'there',
    subject: (n) => `[FYI] ${n} jobs similar to your recent application`,
    eyebrow: 'Jobs for you',
    intro: (ref, name) => `Hi ${name}, based on the job you recently applied to (${ref}), we found similar positions where you have a strong chance:`,
    note: 'These match your recent application — apply early to be prioritized for review.',
    cta: 'View & apply →',
    footer: 'This is an automated email from FYI (salary-fyi.com). Please do not reply directly.',
  },
}

function jobLink(id) {
  return `${SITE_URL}/jobs/${id}?utm_source=fyi&utm_medium=email&utm_campaign=similar_jobs`
}

export function composeEmail({ name, appliedTitle, appliedCompany, jobs, lang }) {
  const t = EMAIL_I18N[lang] || EMAIL_I18N.vi
  const who = name || t.fallbackName
  const refText = appliedCompany ? `${appliedTitle} · ${appliedCompany}` : appliedTitle
  const refHtml = `<b style="color:#111">${escapeHtml(appliedTitle)}</b>${appliedCompany ? ` · ${escapeHtml(appliedCompany)}` : ''}`
  const subject = t.subject(jobs.length)

  const text =
`${t.intro(refText, who)}

${jobs.map(j => `■ ${j.title}${j.company ? ` (${j.company})` : ''}\n${jobLink(j.id)}`).join('\n\n')}

${t.note}

— FYI (salary-fyi.com)`

  // 공고 카드 리스트 — 각 카드 전체가 해당 공고 링크. 레이아웃 table, 스타일 인라인.
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
            <span style="color:#ea580c;font-size:13px;font-weight:800">${escapeHtml(t.cta)}</span>
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
        <div style="font-size:11px;font-weight:800;letter-spacing:1.5px;color:#ea580c;text-transform:uppercase;margin-bottom:10px">${escapeHtml(t.eyebrow)}</div>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#4b5563">${t.intro(refHtml, `<b style="color:#111">${escapeHtml(who)}</b>`)}</p>
        ${cards}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 0">
          <tr><td style="background:#fff7ed;border-left:3px solid #ea580c;border-radius:0 8px 8px 0;padding:13px 16px;font-size:13.5px;line-height:1.6;color:#7c2d12">${escapeHtml(t.note)}</td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:20px 6px;text-align:center;font-size:12px;line-height:1.6;color:#9ca3af">
        ${escapeHtml(t.footer)}<br>
        <a href="${SITE_URL}" style="color:#9ca3af;text-decoration:underline">salary-fyi.com</a>
      </td></tr>
    </table>
  </td></tr></table>
</div>`
  return { subject, text, html }
}

// 최근 지원자 → 지원 직군과 같은 company_self 공고 매칭. 이미 지원/이미 발송한 공고는 제외.
// cron(/api/cron/similar-recommend)도 이 함수를 그대로 사용.
export async function computeMatches(days) {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString()

  // 1) 최근 지원 내역 (지원 공고의 role 조인). PostgREST 1000행 제한 → 페이지네이션.
  const PAGE = 1000
  let apps = []
  for (let offset = 0; ; offset += PAGE) {
    const { data: page, error } = await supabase
      .from('job_applications')
      .select('job_id, user_id, applicant_email, applicant_name, created_at, jobs(role, title, company)')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!page?.length) break
    apps = apps.concat(page)
    if (page.length < PAGE) break
  }

  // 2) 활성 기업등록 공고
  const { data: companyJobs, error: jobErr } = await supabase
    .from('jobs')
    .select('id, title, company, role, logo_url')
    .eq('source', 'company_self')
    .eq('is_active', true)
  if (jobErr) throw new Error(jobErr.message)
  const jobsByRole = {}
  for (const j of companyJobs || []) {
    if (!j.role) continue
    ;(jobsByRole[j.role] = jobsByRole[j.role] || []).push(j)
  }

  // 3) 이미 발송한 (사람, 공고) — 중복 제외용
  const { data: sent } = await supabase
    .from('job_recommendations')
    .select('user_id, to_email, job_id')
  const sentKeys = new Set()
  for (const r of sent || []) {
    if (r.user_id) sentKeys.add(`u:${r.user_id}|${r.job_id}`)
    if (r.to_email) sentKeys.add(`e:${r.to_email.toLowerCase()}|${r.job_id}`)
  }

  // 4) 지원자별 집계 (key = user_id || email)
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
    if (!g.recent && a.jobs) g.recent = { title: a.jobs.title, company: a.jobs.company } // 최신순 정렬이라 첫 등장이 최근
  }

  // 5) 매칭
  const result = []
  for (const [key, g] of byApplicant) {
    if (!g.email) continue // 발송할 이메일 없으면 스킵
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
      user_id: g.user_id,
      email: g.email,
      name: g.name,
      applied: g.recent || { title: '', company: '' },
      jobs: jobs.slice(0, MAX_JOBS_PER_EMAIL),
    })
  }
  // 추천 공고 많은 사람 먼저
  result.sort((a, b) => b.jobs.length - a.jobs.length)
  return result
}

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 90))
    try {
      const applicants = await computeMatches(days)
      return res.status(200).json({ days, count: applicants.length, applicants })
    } catch (e) {
      if (/job_recommendations/.test(e.message || '')) {
        return res.status(400).json({ error: 'job_recommendations 테이블/컬럼 미적용 — 20260709_*.sql 을 먼저 적용하세요' })
      }
      return res.status(500).json({ error: e.message })
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { applicants, lang = 'vi', preview } = req.body || {}
  if (!Array.isArray(applicants) || applicants.length === 0) return res.status(400).json({ error: 'applicants required' })
  if (!EMAIL_I18N[lang]) return res.status(400).json({ error: `unknown lang: ${lang}` })

  // 클라이언트가 넘긴 jobId 는 실제 활성 company_self 공고인지 서버에서 재검증.
  const allJobIds = [...new Set(applicants.flatMap(a => a.jobIds || []))]
  const { data: validJobs, error: vErr } = await supabase
    .from('jobs')
    .select('id, title, company, logo_url')
    .in('id', allJobIds.length ? allJobIds : ['00000000-0000-0000-0000-000000000000'])
    .eq('source', 'company_self')
    .eq('is_active', true)
  if (vErr) return res.status(500).json({ error: vErr.message })
  const jobById = Object.fromEntries((validJobs || []).map(j => [j.id, j]))

  const buildFor = (a) => {
    const jobs = (a.jobIds || []).map(id => jobById[id]).filter(Boolean)
    return { jobs, email: composeEmail({ name: a.name, appliedTitle: a.appliedTitle || '', appliedCompany: a.appliedCompany || '', jobs, lang }) }
  }

  if (preview) {
    const a = applicants[0]
    const { jobs, email } = buildFor(a)
    if (!jobs.length) return res.status(400).json({ error: 'no valid jobs for preview' })
    return res.status(200).json({ to: a.email, ...email })
  }

  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)

  // 중복 재확인용 발송이력 (프리뷰~발송 사이 상태 변화 대비) — 루프 밖에서 1회 조회.
  const { data: existing } = await supabase
    .from('job_recommendations')
    .select('job_id, user_id, to_email')
  const sentByUser = new Set()   // `${user_id}|${job_id}`
  const sentByEmail = new Set()  // `${email}|${job_id}`
  for (const r of existing || []) {
    if (r.user_id) sentByUser.add(`${r.user_id}|${r.job_id}`)
    if (r.to_email) sentByEmail.add(`${r.to_email.toLowerCase()}|${r.job_id}`)
  }

  let sentCount = 0, jobRows = 0
  const skipped = []
  for (const a of applicants) {
    if (!a.email) { skipped.push({ email: a.email, reason: 'no_email' }); continue }
    const isSent = (jid) => (a.user_id && sentByUser.has(`${a.user_id}|${jid}`)) || sentByEmail.has(`${a.email.toLowerCase()}|${jid}`)
    const jobs = (a.jobIds || []).map(id => jobById[id]).filter(Boolean).filter(j => !isSent(j.id))
    if (!jobs.length) { skipped.push({ email: a.email, reason: 'already_sent' }); continue }

    const email = composeEmail({ name: a.name, appliedTitle: a.appliedTitle || '', appliedCompany: a.appliedCompany || '', jobs, lang })
    try {
      const r = await resend.emails.send({ from: RESEND_FROM, to: a.email, subject: email.subject, text: email.text, html: email.html })
      if (r.error) throw new Error(r.error.message || 'resend_error')
    } catch (e) {
      skipped.push({ email: a.email, reason: `send_fail: ${e.message}` })
      continue
    }

    if (a.user_id) {
      sendPush([a.user_id], {
        title: { vi: `${jobs.length} việc làm phù hợp với bạn`, ko: `회원님께 맞는 공고 ${jobs.length}건`, en: `${jobs.length} jobs matched for you` },
        body: jobs[0].title,
        category: 'job_recommendation',
        data: { url: `/jobs/${jobs[0].id}` },
      })
    }

    const rows = jobs.map(j => ({
      user_id: a.user_id || null,
      to_email: a.email,
      job_id: j.id,
      job_title: j.title,
      job_company: j.company,
      sent_by: admin.email || null,
      status: 'sent',
      kind: 'similar',
    }))
    const { error: insErr } = await supabase.from('job_recommendations').insert(rows)
    if (insErr) { skipped.push({ email: a.email, reason: `logged_fail: ${insErr.message}` }); continue }
    for (const j of jobs) {
      if (a.user_id) sentByUser.add(`${a.user_id}|${j.id}`)
      sentByEmail.add(`${a.email.toLowerCase()}|${j.id}`)
    }
    sentCount += 1
    jobRows += jobs.length
  }

  return res.status(200).json({ sent: sentCount, jobs: jobRows, skipped })
}
