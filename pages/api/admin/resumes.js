import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'
import { isExcludedEmail } from '../../../lib/admin-metrics'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const COLUMNS_FULL = 'id, full_name, headline, position, yoe_months, location, resume_url, photo_url, is_resume_public, skills, university, major, graduation_year, experiences, english_cert, korean_cert, work_type, salary_min, salary_max, salary_currency, current_salary, resume_platform, resume_source, resume_summary, verified_school_name, verified_school_tier, updated_at, created_at'
    // resume_summary는 20260727, resume_source는 20260621, current_salary는 20260813 migration —
    // 아직 안 깔린 환경에서는 해당 컬럼만 빼고 재시도해 어드민 뷰가 계속 뜨게 한다.
    const COLUMNS_NO_CURRENT = COLUMNS_FULL.replace(', current_salary', '')
    const COLUMNS_NO_SUMMARY = COLUMNS_NO_CURRENT.replace(', resume_summary', '')
    const COLUMNS_FALLBACK = COLUMNS_NO_SUMMARY.replace(', resume_source', '')

    // Supabase select는 기본 1000행에서 조용히 잘린다 — range로 전량 페이지네이션.
    const fetchWith = async (columns) => {
      const all = []
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase
          .from('user_profiles')
          .select(columns)
          .not('resume_url', 'is', null)
          .neq('resume_url', '') // 과거 삭제 버그가 남긴 빈 문자열 방어 — 파일 없는 행은 목록에서 제외
          .order('updated_at', { ascending: false })
          .range(offset, offset + 999)
        if (error) return { data: null, error }
        all.push(...data)
        if (data.length < 1000) break
      }
      return { data: all, error: null }
    }

    let { data, error } = await fetchWith(COLUMNS_FULL)
    if (error && /current_salary/.test(error.message || '')) {
      ;({ data, error } = await fetchWith(COLUMNS_NO_CURRENT))
    }
    if (error && /resume_summary/.test(error.message || '')) {
      ;({ data, error } = await fetchWith(COLUMNS_NO_SUMMARY))
    }
    if (error && /resume_source/.test(error.message || '')) {
      ;({ data, error } = await fetchWith(COLUMNS_FALLBACK))
    }

    if (error) return res.status(500).json({ error: error.message })

    // 연봉 뱃지 인증(salary_verifications approved)으로도 연봉을 안다 — 프로필 미기입자 폴백.
    // 연봉위저드 제출(submissions)은 폴백에서 뺐다(8/13 유저 지시) — 익명 통계용 자기신고라
    // 부정확. 정확한 소스만: 직접기입(current_salary) > 증빙 승인 인증.
    // 유저당 최신 승인 1건. salary_amount는 triệu(백만 VND/월) 단위 그대로 내려준다.
    const verifiedSalary = {}
    for (let offset = 0; ; offset += 1000) {
      const { data: vers, error: verErr } = await supabase
        .from('salary_verifications')
        .select('user_id, salary_amount, created_at')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .range(offset, offset + 999)
      if (verErr || !vers) break
      for (const v of vers) {
        if (!(v.user_id in verifiedSalary)) verifiedSalary[v.user_id] = { salary: v.salary_amount, at: v.created_at }
      }
      if (vers.length < 1000) break
    }

    // Fetch emails from auth
    // 사진은 photo_url(이력서 추출/직접 업로드)만 쓴다 — 구글 아바타 폴백은 유저 지시로 제거(8/5).
    const userIds = new Set(data.map(d => d.id))
    const emails = {}
    if (userIds.size > 0) {
      let page = 1
      while (true) {
        const { data: { users }, error: authErr } = await supabase.auth.admin.listUsers({
          page,
          perPage: 1000,
        })
        if (authErr || !users || users.length === 0) break
        for (const u of users) {
          if (userIds.has(u.id)) emails[u.id] = u.email
        }
        if (users.length < 1000) break
        page++
      }
    }

    // 내부/테스트 계정(@likelion.net 등)은 인재풀에서 제외.
    const result = data
      .map(p => ({
        ...p,
        email: emails[p.id] || '',
        verified_salary: verifiedSalary[p.id]?.salary ?? null,
        verified_salary_at: verifiedSalary[p.id]?.at ?? null,
      }))
      .filter(p => !isExcludedEmail(p.email))

    return res.status(200).json(result)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
