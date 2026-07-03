import { createClient } from '@supabase/supabase-js'
import { findCompanyEmail } from '../../../lib/findEmail'

export const config = { maxDuration: 60 } // 신규 브랜드 이메일 웹서치(건당 수초) 여유

// 픽디(경쟁사·나인하이어 ATS) 현재 공고를 매주 재크롤 → 새로 뜬 고객사 브랜드만 pikdi_targets 캠페인에 추가.
// 이메일은 자동 확보 불가(별도) → 새 브랜드는 email=null·status=todo 로 들어감. 매주 수요일 실행(vercel.json cron).
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const PIKDI_COMPANY_ID = 'e1befed0-4ee6-11ef-b536-2b4fe23e8855'
const API = `https://api.ninehire.com/identity-access/homepage/recruitments?companyId=${PIKDI_COMPANY_ID}`
const EXCLUDE_BRANDS = new Set(['PICKDI', 'Pickdi']) // 픽디 자체 공고 제외

// 자주 나오는 직무 → 한국어. 없으면 원문 유지.
const ROLE_KO = {
  'Influencer Marketer': '인플루언서 마케터',
  'Global Influencer Marketer': '글로벌 인플루언서 마케터',
  'Video Editor': '영상 편집자',
  'Short-form Video Editor': '숏폼 영상 편집자',
  'Marketing Analyst': '마케팅 애널리스트',
  'Ads Creative Designer': '광고 크리에이티브 디자이너',
  'Content Designer': '콘텐츠 디자이너',
  'Social Content Designer': '소셜 콘텐츠 디자이너',
  'KOC Booking Operator': 'KOC·인플루언서 마케팅 운영',
  'Project Manager': '프로젝트 매니저',
}

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  try {
    const resp = await fetch(API, { headers: { 'User-Agent': 'Mozilla/5.0', Origin: 'https://pickdi.ninehire.site' } })
    if (!resp.ok) return res.status(502).json({ error: `ninehire ${resp.status}` })
    const { results = [] } = await resp.json()

    // 브랜드별 직무 집계 (픽디 자체·브랜드 없는 워크플로우 공고 제외)
    const byBrand = new Map()
    for (const r of results) {
      const brand = (r.affiliation || {}).title
      if (!brand || EXCLUDE_BRANDS.has(brand)) continue
      const role = (r.jobGroup || {}).title || (r.externalTitle || '').replace(/^\[[^\]]+\]\s*/, '').trim()
      if (!byBrand.has(brand)) byBrand.set(brand, { brand, roles: new Set(), siteURL: r.siteURL })
      if (role) byBrand.get(brand).roles.add(role)
    }

    // 이미 있는 브랜드 제외
    const { data: existing } = await supabase.from('cold_outreach')
      .select('company_name').eq('campaign', 'pikdi_targets')
    const have = new Set((existing || []).map(r => r.company_name))

    const today = new Date().toISOString().slice(0, 10)
    const added = []
    let searched = 0
    for (const b of byBrand.values()) {
      if (have.has(b.brand)) continue
      const roles = [...b.roles]
      const roleKo = ROLE_KO[roles[0]] || roles[0] || null
      // 이메일 자동 후보 검색(웹서치·best-effort·미검증, 최대 8건/실행) — 발송 전 사람이 반드시 확인
      let email = null, emailNote = ''
      if (searched < 8) {
        searched++
        try {
          const f = await findCompanyEmail(b.brand, roleKo)
          if (f?.email) { email = f.email; emailNote = ' · [auto·미검증]' }
        } catch { /* 검색 실패해도 브랜드는 추가 */ }
      }
      const { error } = await supabase.from('cold_outreach').insert({
        campaign: 'pikdi_targets', owner: 'wsj',
        company_name: b.brand, contact_name: null, email,
        industry_detail: roleKo,
        business_desc: '베트남 현지에서 마케팅·영상·디자인 등 인재를 채용 중',
        memo: `[pikdi-auto ${today}] 직무: ${roles.join(' / ')} · site:${b.siteURL}${emailNote}`,
        status: 'todo',
      })
      if (!error) added.push({ brand: b.brand, roles, email: email || null })
    }

    return res.status(200).json({
      scanned: byBrand.size, existing: have.size, added: added.length, newBrands: added,
    })
  } catch (err) {
    console.error('scrape-pikdi error:', err)
    return res.status(500).json({ error: err.message })
  }
}
