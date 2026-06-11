import supabase from '../../../lib/supabaseAdmin'

// 회사 식별은 프로젝트 전역과 동일하게 이름 문자열을 lower(trim())로 정규화한다.
function norm(s) {
  return (s || '').trim().toLowerCase()
}

async function userFromReq(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user } } = await supabase.auth.getUser(token)
  return user || null
}

export default async function handler(req, res) {
  const company = norm(req.query.company || req.body?.company)

  if (req.method === 'GET') {
    // company 미지정: 로그인 사용자가 팔로우 중인 회사 목록
    if (!company) {
      const user = await userFromReq(req)
      if (!user) return res.status(401).json({ error: 'Unauthorized' })
      const { data } = await supabase
        .from('company_follows')
        .select('company_name, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      return res.status(200).json({ follows: data || [] })
    }

    // company 지정: 팔로워 수 + (로그인 시) 내가 팔로우 중인지
    const { count } = await supabase
      .from('company_follows')
      .select('id', { count: 'exact', head: true })
      .eq('company_name', company)
    let following = false
    const user = await userFromReq(req)
    if (user) {
      const { data } = await supabase
        .from('company_follows')
        .select('id')
        .eq('user_id', user.id)
        .eq('company_name', company)
        .maybeSingle()
      following = !!data
    }
    return res.status(200).json({ company, followerCount: count || 0, following })
  }

  if (req.method === 'POST') {
    const user = await userFromReq(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })
    if (!company) return res.status(400).json({ error: 'Missing company' })
    const { error } = await supabase
      .from('company_follows')
      .upsert({ user_id: user.id, company_name: company }, { onConflict: 'user_id,company_name' })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true, following: true })
  }

  if (req.method === 'DELETE') {
    const user = await userFromReq(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })
    if (!company) return res.status(400).json({ error: 'Missing company' })
    const { error } = await supabase
      .from('company_follows')
      .delete()
      .eq('user_id', user.id)
      .eq('company_name', company)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true, following: false })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
