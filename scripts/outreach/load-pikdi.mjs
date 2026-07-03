// 픽디(경쟁사) 채용대행 고객사를 pikdi_targets 캠페인으로 적재.
// 픽디 자체 공고/워크플로우는 제외. 브랜드별 1행(직무 합침). 이메일은 추후 별도 확보(null).
// 실행: node scripts/outreach/load-pikdi.mjs [--commit]
import fs from 'fs'
import { sb } from './lib.mjs'

const CAMPAIGN = 'pikdi_targets'
const OWNER = 'wsj'
const commit = process.argv.includes('--commit')

const raw = JSON.parse(fs.readFileSync('/tmp/pikdi.json', 'utf8')).results
// 픽디 자체(브랜드=PICKDI) 및 브랜드 없는 워크플로우 공고 제외
const EXCLUDE = new Set(['PICKDI', 'Pickdi'])
const byBrand = new Map()
for (const r of raw) {
  const brand = (r.affiliation || {}).title
  if (!brand || EXCLUDE.has(brand)) continue
  const job = r.externalTitle.replace(/^\[[^\]]+\]\s*/, '').trim()
  if (!byBrand.has(brand)) byBrand.set(brand, { brand, jobs: [], siteURL: r.siteURL })
  byBrand.get(brand).jobs.push(job)
}

const rows = [...byBrand.values()].map(b => ({
  campaign: CAMPAIGN,
  owner: OWNER,
  company_name: b.brand,
  contact_name: null,
  email: null,
  industry: '뷰티/화장품',
  business_desc: `픽디(경쟁사)가 채용대행 중 · 글로벌 마케팅/영상/디자인 계약직`,
  memo: `[pikdi] 픽디 대행 직무: ${b.jobs.join(' / ')} · site:${b.siteURL}`,
  status: 'todo',
}))

console.log(`적재 대상 ${rows.length}개 브랜드:`)
for (const r of rows) console.log(`  - ${r.company_name} — ${r.memo}`)

if (!commit) { console.log('\n(미리보기. 실제 적재는 --commit)'); process.exit(0) }

const { data, error } = await sb.from('cold_outreach').insert(rows).select('id, company_name')
if (error) { console.log('삽입 오류:', error.message); process.exit(1) }
console.log(`\n✅ ${data.length}건 적재 완료 (campaign=${CAMPAIGN}, owner=${OWNER}, email=null)`)
