import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { verifyAdminOrDevStub } from './check'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// 개인메일 도메인 — 이 경우 회사를 도메인으로 묶지 않고 전체 이메일을 email_domain에
// 저장해 계정별로 분리한다(자체가입 경로의 .maybeSingle() 다중행 충돌 방지).
const FREE_MAIL_DOMAINS = new Set([
  'gmail.com', 'naver.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
  'icloud.com', 'daum.net', 'kakao.com', 'protonmail.com',
])

// 고객에게 전달할 임시 비밀번호 — 혼동되는 문자(0/O/1/l/I) 제외한 12자.
function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = crypto.randomBytes(12)
  let out = ''
  for (let i = 0; i < 12; i++) out += chars[bytes[i] % chars.length]
  return out
}

async function findUserByEmail(email) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find((u) => (u.email || '').toLowerCase() === email)
    if (hit) return hit
    if (data.users.length < 200) break
  }
  return null
}

// 어드민: 가입 회사 계정 목록 + 인증 토글
export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const { data: companies } = await supabase
      .from('recruiter_companies')
      .select('id, name, email_domain, verified_at, created_at')
      .order('created_at', { ascending: false })
    const list = companies || []
    const ids = list.map(c => c.id)

    // 멤버 수 / 공고 수 집계
    let members = [], jobs = []
    if (ids.length) {
      const { data: m } = await supabase.from('recruiter_users').select('company_id, email').in('company_id', ids)
      members = m || []
      const { data: j } = await supabase.from('jobs').select('company_id, status, is_active').in('company_id', ids)
      jobs = j || []
    }
    const memberCount = {}, jobCount = {}, liveCount = {}
    members.forEach(m => { memberCount[m.company_id] = (memberCount[m.company_id] || 0) + 1 })
    jobs.forEach(j => {
      jobCount[j.company_id] = (jobCount[j.company_id] || 0) + 1
      if (j.is_active && j.status !== 'pending_review') liveCount[j.company_id] = (liveCount[j.company_id] || 0) + 1
    })

    return res.status(200).json(list.map(c => ({
      ...c,
      member_count: memberCount[c.id] || 0,
      job_count: jobCount[c.id] || 0,
      live_count: liveCount[c.id] || 0,
    })))
  }

  // 계정 발급: 인증유저 생성 + 전용 회사 row + admin 연결. 이메일/비번 로그인용
  // (Google 안 되는 회사 대응). scripts/create-company-account.js의 어드민 버전.
  if (req.method === 'POST') {
    const { email, companyName, contactName } = req.body || {}
    const normEmail = String(email || '').trim().toLowerCase()
    const domain = normEmail.split('@')[1]
    if (!normEmail || !domain) return res.status(400).json({ error: '올바른 이메일이 필요합니다.' })
    if (!companyName || !companyName.trim()) return res.status(400).json({ error: '회사명이 필요합니다.' })
    const contact = (contactName || companyName).trim()
    const password = genPassword()

    try {
      // 1) 인증 유저 — 새로 생성하거나, 이미 있으면 비번 재설정.
      let userId
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: normEmail, password, email_confirm: true,
      })
      if (createErr) {
        const existing = await findUserByEmail(normEmail)
        if (!existing) return res.status(500).json({ error: createErr.message })
        userId = existing.id
        await supabase.auth.admin.updateUserById(userId, { password, email_confirm: true })
      } else {
        userId = created.user.id
      }

      // 2) 이미 회사에 연결돼 있으면 재발급(비번 리셋)으로 처리 — 회사 중복 생성 방지.
      const { data: existingLink } = await supabase
        .from('recruiter_users')
        .select('company_id, recruiter_companies(name)')
        .eq('user_id', userId)
        .maybeSingle()
      if (existingLink?.company_id) {
        return res.status(200).json({
          ok: true, reused: true, email: normEmail, password,
          companyId: existingLink.company_id,
          companyName: existingLink.recruiter_companies?.name || companyName.trim(),
          url: 'https://salary-fyi.com/company',
        })
      }

      // 3) 전용 회사 row 생성(도메인 재사용 안 함). 개인메일은 email_domain에 전체 이메일 저장.
      const emailDomainVal = FREE_MAIL_DOMAINS.has(domain) ? normEmail : domain
      const { data: company, error: cErr } = await supabase
        .from('recruiter_companies')
        .insert({
          name: companyName.trim(),
          email_domain: emailDomainVal,
          created_by: userId,
          verified_at: new Date().toISOString(), // 어드민 발급 = 즉시 인증됨
        })
        .select('id, name')
        .single()
      if (cErr) return res.status(500).json({ error: cErr.message })

      // 4) recruiter_users — admin으로 연결.
      const { error: lErr } = await supabase
        .from('recruiter_users')
        .upsert(
          { user_id: userId, company_id: company.id, email: normEmail, full_name: contact, role: 'admin' },
          { onConflict: 'user_id' }
        )
      if (lErr) return res.status(500).json({ error: lErr.message })

      return res.status(200).json({
        ok: true, email: normEmail, password,
        companyId: company.id, companyName: company.name,
        url: 'https://salary-fyi.com/company',
      })
    } catch (e) {
      return res.status(500).json({ error: e.message || String(e) })
    }
  }

  if (req.method === 'PUT') {
    const { id, verified } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id required' })
    const { error } = await supabase
      .from('recruiter_companies')
      .update({ verified_at: verified ? new Date().toISOString() : null })
      .eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
