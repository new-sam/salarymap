import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'
import { findCompanyContact } from '../../../lib/findEmail'

// 픽디(경쟁사·나인하이어 ATS) 크롤링 열람 API.
// GET  — 현재 게시 중인 공고를 라이브로 + 브랜드별 컨택/최초 발견일(cold_outreach pikdi_targets).
// POST — { brand, role } 담당자 이름·이메일 웹서치(OpenAI) 후 cold_outreach 에 저장. 결과는 미검증 취급.
export const config = { maxDuration: 60 } // 웹서치 수초~수십초

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const PIKDI_COMPANY_ID = 'e1befed0-4ee6-11ef-b536-2b4fe23e8855'
const API = `https://api.ninehire.com/identity-access/homepage/recruitments?companyId=${PIKDI_COMPANY_ID}`
const EXCLUDE_BRANDS = new Set(['PICKDI', 'Pickdi']) // 픽디 자체 공고 제외 (고객사만)

// 브랜드명 조인용 정규화 — DB(수기/크론 적재)와 라이브 API의 대소문자/아포스트로피 차이 흡수
const norm = (s) => (s || '').toLowerCase().replace(/[’']/g, "'").trim()

async function pikdiRows() {
  const { data } = await supabase
    .from('cold_outreach')
    .select('id, company_name, contact_name, email, memo, created_at')
    .eq('campaign', 'pikdi_targets')
  return data || []
}

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  // 담당자 컨택 웹서치 → cold_outreach 저장 (브랜드당 1행, 없으면 생성)
  if (req.method === 'POST') {
    const { brand, role } = req.body || {}
    if (!brand) return res.status(400).json({ error: 'brand required' })
    try {
      const found = await findCompanyContact(brand, role || '')
      const today = new Date().toISOString().slice(0, 10)
      const note = found
        ? `[contact-auto ${today}·미검증] ${found.contact_name || ''} ${found.email || ''}${found.source ? ` src:${found.source}` : ''}`.replace(/\s+/g, ' ').trim()
        : `[contact-auto ${today}] 못 찾음`
      const row = (await pikdiRows()).find(r => norm(r.company_name) === norm(brand))
      if (row) {
        await supabase.from('cold_outreach').update({
          ...(found?.email ? { email: found.email } : {}),
          ...(found?.contact_name ? { contact_name: found.contact_name } : {}),
          memo: `${row.memo ? row.memo + '\n' : ''}${note}`,
          updated_at: new Date().toISOString(),
        }).eq('id', row.id)
      } else {
        await supabase.from('cold_outreach').insert({
          campaign: 'pikdi_targets', owner: 'wsj', status: 'todo',
          company_name: brand, industry_detail: role || null,
          email: found?.email || null, contact_name: found?.contact_name || null,
          memo: note,
        })
      }
      return res.status(200).json({ ok: true, found: found || null })
    } catch (err) {
      console.error('pikdi contact search error:', err)
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const resp = await fetch(API, { headers: { 'User-Agent': 'Mozilla/5.0', Origin: 'https://pickdi.ninehire.site' } })
    if (!resp.ok) return res.status(502).json({ error: `ninehire ${resp.status}` })
    const { results = [] } = await resp.json()

    const jobs = results
      .filter(r => (r.affiliation || {}).title && !EXCLUDE_BRANDS.has(r.affiliation.title))
      .map(r => ({
        brand: r.affiliation.title,
        title: r.externalTitle || r.title,
        role: (r.jobGroup || {}).title || null,
        employment: r.employmentType || [],
        career: r.career || null,
        createdAt: r.createdAt || null,
        deadline: r.deadlineValue || null,
        url: r.addressKey ? `https://pickdi.ninehire.site/job_posting/${r.addressKey}` : null,
      }))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

    // 브랜드별 컨택/최초 발견일 — 주간 크론(/api/cron/scrape-pikdi)과 이 API의 POST가 적재
    const byName = new Map()
    for (const r of await pikdiRows()) {
      const prev = byName.get(norm(r.company_name))
      if (!prev || r.created_at < prev.first_seen) {
        byName.set(norm(r.company_name), {
          name: r.company_name, first_seen: r.created_at,
          email: r.email || prev?.email || null,
          contact_name: r.contact_name || prev?.contact_name || null,
        })
      } else if (!prev.email && r.email) { prev.email = r.email; prev.contact_name = prev.contact_name || r.contact_name }
    }

    return res.status(200).json({ fetchedAt: new Date().toISOString(), jobs, seenBrands: [...byName.values()] })
  } catch (err) {
    console.error('admin/pikdi error:', err)
    return res.status(500).json({ error: err.message })
  }
}
