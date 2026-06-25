import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// 전체(web+app) 유저 자산·관계 누적 현황.
//  - userFollows: 유저↔유저 팔로우 관계 수 (user_follows)
//  - subscriptions: 유저→기업 구독 수 (company_follows, 구 "기업 팔로우")
//  - verifiedWorkers: 재직 인증(verified_company_name) 보유 유저 수
//  - resumeHolders: 이력서 등록(resume_url) 유저 수, resumePublic: 그중 공개(is_resume_public)
export default async function handler(req, res) {
  const user = await verifyAdminOrDevStub(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const headCount = (q) => q.then(({ count }) => count ?? 0)

  const [userFollows, subscriptions, verifiedWorkers, resumeHolders, resumePublic] = await Promise.all([
    headCount(supabase.from('user_follows').select('id', { count: 'exact', head: true })),
    headCount(supabase.from('company_follows').select('id', { count: 'exact', head: true })),
    headCount(supabase.from('user_profiles').select('id', { count: 'exact', head: true }).not('verified_company_name', 'is', null)),
    headCount(supabase.from('user_profiles').select('id', { count: 'exact', head: true }).not('resume_url', 'is', null)),
    headCount(supabase.from('user_profiles').select('id', { count: 'exact', head: true }).not('resume_url', 'is', null).eq('is_resume_public', true)),
  ])

  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({ userFollows, subscriptions, verifiedWorkers, resumeHolders, resumePublic })
}
