import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const { data } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false })
    const jobs = data || []
    // 등록자 이메일 매핑 (created_by -> recruiter_users.email)
    const creatorIds = [...new Set(jobs.map(j => j.created_by).filter(Boolean))]
    let emailMap = {}
    if (creatorIds.length) {
      const { data: ru } = await supabase
        .from('recruiter_users')
        .select('user_id, email')
        .in('user_id', creatorIds)
      emailMap = Object.fromEntries((ru || []).map(u => [u.user_id, u.email]))
    }
    // 계정(회사) 매핑 (company_id -> recruiter_companies.name)
    const companyIds = [...new Set(jobs.map(j => j.company_id).filter(Boolean))]
    let companyMap = {}
    if (companyIds.length) {
      const { data: rc } = await supabase
        .from('recruiter_companies')
        .select('id, name')
        .in('id', companyIds)
      companyMap = Object.fromEntries((rc || []).map(c => [c.id, c.name]))
    }
    return res.status(200).json(jobs.map(j => ({
      ...j,
      poster_email: emailMap[j.created_by] || null,
      account_company: companyMap[j.company_id] || null,
    })))
  }

  if (req.method === 'POST') {
    const { data, error } = await supabase
      .from('jobs')
      .insert(req.body)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  if (req.method === 'PUT') {
    const { id, ...updates } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })
    // KTC 공고의 JD 를 수정하면 /ktc 가 우선 렌더하는 raw_payload.ktc 4블록 스냅샷을 걷어내
    // 양쪽 탭(/jobs, /ktc)이 수정된 description 을 보게 한다 (lib/ktcJobs.js shape 폴백)
    if (typeof updates.description === 'string') {
      const { data: cur } = await supabase
        .from('jobs')
        .select('source, description, raw_payload')
        .eq('id', id)
        .maybeSingle()
      if (cur?.source === 'ktc' && cur.description !== updates.description && cur.raw_payload?.ktc) {
        const ktc = { ...cur.raw_payload.ktc }
        delete ktc.description
        delete ktc.responsibilities
        delete ktc.requirements
        delete ktc.benefits
        updates.raw_payload = { ...cur.raw_payload, ktc }
      }
    }
    const { data, error } = await supabase
      .from('jobs')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })
    const { error } = await supabase.from('jobs').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
