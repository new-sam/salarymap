import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'
import { ROLE_GROUPS } from '../../../constants/jobs'

// 승주 작업실 · 프로필 사진 탭 — 인재풀 사진 보유 현황(기업 쇼케이스 카드 품질 지표이자
// 사진 등록 유도 콜드메일의 베이스라인). 출처는 photo_url 경로 패턴으로 구분:
//   <id>.jpg(루트)=직접 업로드 · /photo_cv=CV 추출(vision 검증) · /photo_<hex>=웹 /cv 파싱 · /photo_social=소셜 아바타(vision 검증)
const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)

const ROLE_TO_GROUP = {}
for (const g of ROLE_GROUPS) for (const r of g.roles) ROLE_TO_GROUP[r.value] = g.key
ROLE_TO_GROUP['AI/Data'] = 'data'
const DEV = new Set(['software', 'data', 'infra', 'qa', 'security', 'leadership', 'other_tech'])

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    // 기본 1000행 캡 — range 루프로 전량
    const rows = []
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, photo_url, position, is_resume_public')
        .not('resume_url', 'is', null)
        .neq('resume_url', '')
        .range(offset, offset + 999)
      if (error) return res.status(500).json({ error: error.message })
      rows.push(...data)
      if (data.length < 1000) break
    }

    const srcOf = (u) => {
      const p = (u || '').split('/object/public/profiles/')[1] || ''
      if (!p) return 'upload' // 예상 밖 경로 — 직접 업로드로 분류
      if (p.includes('/photo_cv')) return 'cv'
      if (p.includes('/photo_social')) return 'social'
      if (p.includes('/photo_')) return 'webParse'
      return 'upload'
    }
    const withPhoto = rows.filter(r => r.photo_url)
    const sources = { upload: 0, cv: 0, webParse: 0, social: 0 }
    for (const r of withPhoto) sources[srcOf(r.photo_url)]++

    const groupOf = (p) => ROLE_TO_GROUP[p] || null
    const seg = (list) => ({ total: list.length, withPhoto: list.filter(r => r.photo_url).length })
    const segments = {
      dev: seg(rows.filter(r => DEV.has(groupOf(r.position)))),
      nondev: seg(rows.filter(r => { const g = groupOf(r.position); return g && !DEV.has(g) })),
      unclassified: seg(rows.filter(r => !groupOf(r.position))),
      public: seg(rows.filter(r => r.is_resume_public)),
      private: seg(rows.filter(r => !r.is_resume_public)),
    }

    return res.status(200).json({ total: rows.length, withPhoto: withPhoto.length, sources, segments })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
