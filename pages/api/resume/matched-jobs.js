import { createClient } from '@supabase/supabase-js'
import { matchJobs, decorateJob } from '../../../lib/matchJobs'

/* 로그인 유저의 프로필 → 맞는 공고 N개. /resume 등록 완료 화면이 쓴다.
   매칭 기준은 추천 콜드메일과 같은 lib/matchJobs — 메일로 "맞는 공고"라고 보낸 것과
   화면이 보여주는 것이 갈리면 안 된다.

   프로필이 비어 있으면(파싱 전이거나 파싱이 실패한 경우) 매칭할 근거가 없다. 그때는
   빈 목록 대신 최근 공고를 주되 matched:false 로 알린다 — 화면이 "맞는 공고"라고
   부르지 않게 하려는 것이다. 근거 없이 맞다고 하면 그건 그냥 거짓말이다. */

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)

const TOP = 3

// 카드에 그리는 값만 내보낸다. description/tech_stack 은 매칭용이라 응답에서 뺀다.
const card = (j) => ({
  id: j.id,
  title: j.title,
  company: j.company,
  role: j.role,
  location: j.location,
  logo_url: j.logo_url,
  image_url: j.image_url,
  type: j.type,
  experience_min: j.experience_min,
  experience_max: j.experience_max,
  salary_min: j.salary_min,
  salary_max: j.salary_max,
  source: j.source,
})

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })

  try {
    const [{ data: profile }, { data: rows }, { data: mine }] = await Promise.all([
      supabase.from('user_profiles')
        .select('position, headline, skills, yoe_months, location, desired_roles')
        .eq('id', user.id).maybeSingle(),
      supabase.from('jobs')
        .select('id,title,company,role,location,experience_min,experience_max,description,tech_stack,logo_url,image_url,type,salary_min,salary_max,source,created_at')
        .eq('is_active', true).in('source', ['ktc', 'company_self']),
      supabase.from('job_applications').select('job_id').eq('user_id', user.id),
    ])

    const jobs = (rows || []).filter((j) => !/likelion/i.test(j.company || '')).map(decorateJob)
    // 이미 지원한 공고를 "지원하세요"로 다시 내밀지 않는다.
    const exclude = new Set((mine || []).map((a) => a.job_id))

    // 같은 회사가 목록을 다 차지하지 않게 회사당 1개(/cv 완료 모달과 같은 규칙).
    // matchJobs 자체는 손대지 않는다 — 추천 메일은 지금 규칙 그대로 나가야 한다.
    const perCompany = (list, pick) => {
      const seen = new Set()
      return list.filter((x) => {
        const c = pick(x).company
        if (seen.has(c)) return false
        seen.add(c)
        return true
      }).slice(0, TOP)
    }

    const matched = profile ? perCompany(matchJobs(profile, jobs, exclude), (m) => m.job) : []
    if (matched.length) {
      return res.json({ matched: true, jobs: matched.map((m) => card(m.job)) })
    }

    const recent = perCompany(
      jobs.filter((j) => !exclude.has(j.id)).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
      (j) => j,
    )
    return res.json({ matched: false, jobs: recent.map(card) })
  } catch (e) {
    console.error('matched-jobs error:', e.message)
    return res.status(500).json({ error: 'failed' })
  }
}
