import supabase from '../../../lib/supabaseAdmin'
import { verifyToken } from '../../../lib/campaignToken'
import { notifyTeamNewApplication } from '../../../lib/notifyTeamNewApplication'
import { notifyApplicantReceipt } from '../../../lib/notifyApplicantReceipt'

// 콜드메일 공고 랜딩(go-public jobs 캠페인)의 원탭 지원 — 로그인 없이 캠페인 토큰으로
// 본인 확인 후 프로필의 이력서/정보로 job_applications에 지원을 넣는다.
// 측정: application_source='coldmail_jobs' + events coldmail_job_apply.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const parsed = verifyToken(req.body?.t)
  if (!parsed) return res.status(401).json({ error: 'invalid_token' })
  const { userId, campaign } = parsed
  const jobId = req.body?.jobId
  if (!jobId) return res.status(400).json({ error: 'jobId required' })

  try {
    const [{ data: p }, { data: job }] = await Promise.all([
      supabase.from('user_profiles')
        .select('email, full_name, role, resume_url, verified_company_name')
        .eq('id', userId).single(),
      supabase.from('jobs').select('id, title, company, is_active').eq('id', jobId).single(),
    ])
    if (!p?.resume_url) return res.status(400).json({ error: 'no_resume' })
    if (!job || !job.is_active) return res.status(400).json({ error: 'job_closed' })

    // 중복 지원 방지(버튼 재클릭/재방문) — 이미 지원했으면 성공처럼 응답만.
    const { data: dup } = await supabase.from('job_applications')
      .select('id').eq('job_id', jobId).eq('user_id', userId).limit(1)
    if (dup?.length) return res.status(200).json({ ok: true, already: true })

    const baseRow = {
      job_id: job.id,
      job_title: job.title,
      job_company: job.company,
      user_id: userId,
      resume_url: p.resume_url,
      applicant_email: p.email || null,
      applicant_name: p.full_name || null,
      applicant_role: p.role || null,
      applicant_company: p.verified_company_name || null,
    }
    const sourceRow = {
      application_source: 'coldmail_jobs',
      utm_campaign: campaign,
      platform: 'web',
    }

    const insert = (row) => supabase.from('job_applications').insert(row).select('id').single()
    let { data, error } = await insert({ ...baseRow, ...sourceRow })
    // /api/job-applications와 동일한 폴백 — 출처 컬럼 마이그레이션이 없는 환경에서도 지원은 접수.
    if (error && (error.code === 'PGRST204' || /utm_|application_source|platform/.test(error.message || ''))) {
      ;({ data, error } = await insert(baseRow))
    }
    if (error) return res.status(500).json({ error: error.message })

    await supabase.from('events').insert([{
      event: 'coldmail_job_apply', page: '/api/resume/quick-apply',
      meta: { campaign, job_id: job.id, job_company: job.company }, user_id: userId,
    }])

    // 지원자 접수확인 + 채용팀 알림 — 일반 지원 플로우와 동일하게 완료까지 await.
    if (data?.id) {
      await Promise.all([notifyApplicantReceipt(data.id), notifyTeamNewApplication(data.id)])
    }

    return res.status(201).json({ ok: true })
  } catch (e) {
    console.error('quick-apply error:', e.message)
    return res.status(500).json({ error: e.message })
  }
}
