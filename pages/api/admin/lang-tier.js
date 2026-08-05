import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'
import { tierOfProfile } from '../../../lib/langTier'
import { eliteCategory } from '../../../lib/talentCategory'

/* 어학 A급·B급 전시장(/admin/lang-scores 상단 버튼)의 사람 목록.

   lang-scores.js 와 나눈 이유는 무게다. 저쪽은 세 칼럼만 읽어 숫자를 세는 화면이라
   가볍고 자주 열리는데, 여기는 사진·이력서·경력까지 끌어온다. 한 응답에 합치면
   분포만 보러 들어와도 카드 데이터를 매번 받는다 — 버튼을 누를 때만 부른다.

   급 판정은 lib/langTier 를 그대로 쓴다. 여기서 규칙을 다시 쓰면 "A급 74명"과
   전시장 카드 수가 조용히 어긋난다.

   ?tier=A|B (기본 A) */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

// 카드에 쓰는 것만. resumes.js 의 전체 칼럼에서 연봉·위치 등은 뺐다 —
// 여기서 판단하는 건 '어학 되는 사람 중 직무가 좋아 보이나' 하나다.
// resume_summary 는 파서가 만든 한국어 자산이다(name_ko·edu_ko·degree·bullets 3줄) —
// 이력서 원문이 영어·베트남어라 카드에서 한글로 읽히는 건 사실상 이 필드뿐이다.
const COLUMNS = 'id, full_name, email, headline, position, yoe_months, university, major, ' +
  'photo_url, resume_url, skills, experiences, english_cert, korean_cert, role, updated_at, resume_summary'

// 파서가 뱉는 값은 이 넷뿐이다(lib/parseResume.js) — 없는 값은 원문 그대로 내보낸다.
const DEGREE_KO = { Associate: '전문학사', Bachelor: '학사', Master: '석사', PhD: '박사' }

async function fetchAll(columns) {
  const all = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('user_profiles').select(columns).range(from, from + 999)
    if (error) throw error
    all.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return all
}

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  const tier = req.query.tier === 'B' ? 'B' : 'A'

  try {
    const profiles = await fetchAll(COLUMNS)

    const people = []
    for (const p of profiles) {
      if (p.role === 'hr') continue
      const t = tierOfProfile(p)
      if (!t || t.tier !== tier) continue
      const s = p.resume_summary || {}
      people.push({
        id: p.id,
        name: p.full_name || '(이름 없음)',
        nameKo: s.name_ko || '',
        email: p.email || '',
        headline: p.headline || '',
        bullets: Array.isArray(s.bullets) ? s.bullets : [], // 한글 주요이력 3줄
        position: p.position || '',
        // 직군은 인재풀 엘리트와 같은 규칙(lib/talentCategory) — 여섯 갈래 밖이면 null
        cat: eliteCategory(p),
        // 0(신입)과 null(파싱 안 됨)을 합치면 년차 필터가 미상까지 '3년 미만'으로 센다
        yoeMonths: p.yoe_months ?? null,
        university: p.university || '',
        eduKo: [DEGREE_KO[s.degree] || s.degree, s.edu_ko].filter(Boolean).join(' · '), // 한글 학력
        major: p.major || '',
        photo: p.photo_url || '',
        resume: p.resume_url || '',
        skills: Array.isArray(p.skills) ? p.skills.slice(0, 8) : [],
        certs: t.certs, // [{cert, band, tier, value}] — 카드에 원문 점수를 그대로 보여준다
        updatedAt: p.updated_at || null,
      })
    }

    /* 이력서 있는 사람이 먼저다 — 직무를 보고 고르는 화면인데 이력서가 없으면
       볼 게 없다. 그 다음은 연차 많은 순. */
    people.sort((a, b) =>
      (b.resume ? 1 : 0) - (a.resume ? 1 : 0) ||
      (b.yoeMonths ?? -1) - (a.yoeMonths ?? -1) ||
      String(b.updatedAt).localeCompare(String(a.updatedAt)))

    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({
      tier,
      people,
      withResume: people.filter((p) => p.resume).length,
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
